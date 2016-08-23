require("./stylesheets/main.less");
var Panel = require("./panel");

// Open file panels
codebox.panels.add(Panel, {}, {
    title: "文件",
    icon: "file-directory",
    section: "files",
    at: 0
});
