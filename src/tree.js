var settings = require("./settings");

var _ = codebox.require("hr.utils");
var $ = codebox.require("jquery");
var File = codebox.require("models/file");
var View = codebox.require("hr.view");
var dialogs = codebox.require("utils/dialogs");
var menu = codebox.require("utils/menu");
var upload = codebox.require("utils/upload");


var FileItem = View.extend({
    tagName: "li",
    events: {
        "click .file": "onClick"
    },

    initialize: function(options) {
        FileItem.__super__.initialize.apply(this, arguments);

        this.tree = null;

        this.$content = $("<div>", {
            "class": "file"
        });

        this.$caret = $("<span>", {
            "class": "caret"
        });

        this.$name = $("<span>", {
            "class": "filename"
        });

        this.$caret.appendTo(this.$content);
        this.$name.appendTo(this.$content);

        this.$content.appendTo(this.$el);

        // Bind file changement
        this.listenTo(this.model, "destroy", this.remove);

        // Bind settings changement
        this.listenTo(settings.data, "change", this.onAdaptVisibility);

        // Context menu
        menu.add(this.$content, this.getContextMenu.bind(this));
    },

    render: function() {
        this.onAdaptVisibility();
        this.$caret.toggleClass("c-hidden", !this.model.isDirectory());
        this.$name.text(this.model.get("name"));
        this.$content.attr("data-filepath", this.model.get("path"));
        this.$content.css("padding-left", (this.parent.options.indentation*12)+"px");

        return this.ready();
    },

    onAdaptVisibility: function() {
        var visible = true;
        var name = this.model.get("name");

        if (name == ".git" && !settings.data.get("showDotGit")) visible = false;
        if (name[0] == "." && !settings.data.get("showHidden")) visible = false;
        this.$el.toggle(visible);
    },

    onClick: function(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (this.model.isDirectory()) {
            if (!this.tree) {
                this.tree = new FilesTree({
                    model: this.model,
                    indentation: this.parent.options.indentation + 1
                });
                this.tree.appendTo(this);
                this.tree.refresh();
            } else {
                this.tree.$el.toggleClass("hidden");
            }
        } else {
            this.model.open();
        }

        if (this.tree) this.$caret.toggleClass("open", !this.tree.$el.hasClass("hidden"));
    },

    // Generate the context menu items
    getContextMenu: function() {
        var that = this;
        var items = [
            {
                label: "重命名...",
                click: function() {
                    return dialogs.prompt("新的文件名:", that.model.get("name"))
                    .then(function(n) {
                        return that.model.rename(n);
                    });
                }
            }
        ];

        if (this.model.isDirectory()) {
            items = items.concat([
                {
                    type: "divider"
                },
                {
                    label: "新建文件",
                    click: function() {
                        return dialogs.prompt("创建新文件:", "untitled")
                        .then(function(n) {
                            return that.model.create(n);
                        });
                    }
                },
                {
                    label: "新建文件夹",
                    click: function() {
                        return dialogs.prompt("创建新文件夹:", "untitled")
                        .then(function(n) {
                            return that.model.mkdir(n);
                        });
                    }
                },
                {
                    type: "divider"
                },
                {
                    label: "上传...",
                    type: "menu",
                    items: [
                        {
                            label: "文件",
                            click: function() {
                                codebox.statusbar.progress(
                                    upload.upload({
                                        'url': "/rpc/fs/upload",
                                        'data': {
                                            "path": that.model.get("path")
                                        }
                                    }),
                                    {
                                        prefix: "上传文件"
                                    }
                                )
                                .fail(dialogs.alert);
                            }
                        },
                        {
                            label: "文件夹",
                            click: function() {
                                codebox.statusbar.progress(
                                    upload.upload({
                                        'url': "/rpc/fs/upload",
                                        'directory': true,
                                        'data': {
                                            "path": that.model.get("path")
                                        }
                                    }),
                                    {
                                        prefix: "上传文件夹"
                                    }
                                ).fail(dialogs.alert);
                            }
                        }
                    ]
                },
                {
                    type: "divider"
                },
                {
                    label: "刷新",
                    click: this.doRefresh.bind(this)
                },
                {
                    type: "divider"
                },
                {
                    label: "删除文件夹",
                    click: this.doDelete.bind(this)
                }
            ]);
            if (codebox.services && codebox.services['projecRunnerService']) {
                items = items.concat([
                    {
                        type: "divider"
                    },
                    {
                        label: "运行项目",
                        click: function() {
                            return codebox.services['projecRunnerService'].run(that.model.get("path")).then(function(data){
                                window.open(data);
                            });
                        }
                    }
                    ]);
            }
        } else {
            items = items.concat([
                {
                    label: "删除文件",
                    click: this.doDelete.bind(this)
                }
            ]);
        }

        return items;
    },

    // Delete this file/folder
    doDelete: function() {
        return dialogs.confirm("删除 "+(this.model.isDirectory()? "文件夹": "文件"))
        .then(this.model.remove.bind(this.model));
    },

    // Refresh list
    doRefresh: function() {
        if (this.tree) this.tree.refresh();
    }
});

var FilesTree = View.extend({
    tagName: "ul",
    className: "component-files-tree",
    defaults: {
        indentation: 1
    },

    initialize: function(options) {
        FilesTree.__super__.initialize.apply(this, arguments);

        this.listenTo(this.model, "fs:files:created", this.created);
    },

    created: function(e) {
        var path = e.data,
            that = this,
            file = new File();

        this.items = this.items || [];

        return file.stat(path).then(function(f) {
            var item = new FileItem({
                model: f
            }, that);
            that.items.push(item);
        }).then(this.update.bind(this));
    },

    refresh: function() {
        var that = this;

        _.each(this.items || [], function(item) {
            item.remove();
        });

        return this.model.list()
        .then(function(files) {
            that.items = _.map(files, function(file) {
                return new FileItem({
                    model: file
                }, that);
            });
        })
        .then(this.update.bind(this));
    },

    render: function() {
        this.$el.empty();

        _.each(this.items || [], function(item) {
            item.appendTo(this);
            item.render();
        }, this);

        return this.ready();
    }
});

module.exports = FilesTree;
