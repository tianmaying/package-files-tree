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
                label: "Rename...",
                click: function() {
                    return dialogs.prompt("New name:", that.model.get("name"))
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
                    label: "New File",
                    click: function() {
                        return dialogs.prompt("Create a new file:", "untitled")
                        .then(function(n) {
                            return that.model.create(n);
                        });
                    }
                },
                {
                    label: "New Folder",
                    click: function() {
                        return dialogs.prompt("Create a new folder:", "untitled")
                        .then(function(n) {
                            return that.model.mkdir(n);
                        });
                    }
                },
                {
                    type: "divider"
                },
                {
                    label: "Upload",
                    type: "menu",
                    items: [
                        {
                            label: "Files",
                            click: function() {
                                codebox.statusbar.progress(
                                    upload.upload({
                                        'url': "/rpc/fs/upload",
                                        'data': {
                                            "path": that.model.get("path")
                                        }
                                    }),
                                    {
                                        prefix: "Uploading files"
                                    }
                                )
                                .fail(dialogs.alert);
                            }
                        },
                        {
                            label: "Folder",
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
                                        prefix: "Uploading folder"
                                    }
                                )
                                .fail(dialogs.alert);
                            }
                        }
                    ]
                },
                {
                    type: "divider"
                },
                {
                    label: "Refresh List",
                    click: this.doRefresh.bind(this)
                },
                {
                    type: "divider"
                },
                {
                    label: "Delete Folder",
                    click: this.doDelete.bind(this)
                }
            ]);
            if (codebox.services && codebox.services['projecRunnerService']) {
                items = items.concat([
                    {
                        type: "divider"
                    },
                    {
                        label: "Run As Project",
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
                    label: "Delete File",
                    click: this.doDelete.bind(this)
                }
            ]);
        }

        return items;
    },

    // Delete this file/folder
    doDelete: function() {
        return dialogs.confirm("Delete "+(this.model.isDirectory()? "Folder": "file"))
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
