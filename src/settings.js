module.exports = codebox.settings.schema("tree",
    {
        "title": "Files Tree",
        "type": "object",
        "properties": {
            "toolbar": {
                "description": "Commands in the toolbar",
                "type": "array",
                "items": {
                    "command": {
                        "type": "string"
                    }
                },
                "default": [
                    {
                        "command": "terminal.open"
                    },
                    {
                        "command": "content.open"
                    },
                    {
                        "command": "project.run"
                    }
                ]
            },
            "showToolbar": {
                "description": "Show toolbar",
                "type": "boolean",
                "default": true
            },
            "showHidden": {
                "description": "Show hidden files",
                "type": "boolean",
                "default": true
            },
            "showDotGit": {
                "description": "Show .git folder",
                "type": "boolean",
                "default": false
            }
        }
    }
);
