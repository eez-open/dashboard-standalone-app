import fs from "fs";

const YAML = require("json-to-pretty-yaml");

const manifestJson = require("../resources/manifest.json");

async function getExtraResource() {
    let extensions = (await fs.promises.readdir("./resources/extensions")).map(
        file => ({
            from: "./resources/extensions/" + file,
            to: "extensions/" + file
        })
    );

    return [
        ...extensions,
        {
            from: "./resources/expression-grammar.pegjs",
            to: "expression-grammar.pegjs"
        },
        {
            from: "./resources/manifest.json",
            to: "manifest.json"
        },
        {
            from: "./resources/" + manifestJson.project,
            to: manifestJson.project
        }
    ];
}

const productName = manifestJson.productName;

let files = [
    "build/**",
    "libs/**",
    "LICENSE.TXT",
    "node_modules/**",
    "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
    "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
    "!**/node_modules/*.d.ts",
    "!**/node_modules/.bin",
    "!**/*.js.map",
    "!**/*.css.map",
    "!**/*.ilk",
    "!**/*.lib",
    "!node_modules/better-sqlite3/build/Release/obj",
    "!node_modules/better-sqlite3/build/Release/*.iobj",
    "!node_modules/better-sqlite3/build/Release/*.ipdb",
    "!node_modules/better-sqlite3/deps",
    "!node_modules/better-sqlite3/src",
    "!node_modules/better-sqlite3/docs",
    "!node_modules/bootstrap/js",
    "!node_modules/bootstrap/scss",
    "!node_modules/ffi-napi/deps",
    "!node_modules/ffi-napi/src",
    "!build/eez-studio-ui/_images/background.png",
    "!node_modules/plotly.js/dist/**",
    "!node_modules/plotly.js/src/**",
    "node_modules/plotly.js/dist/plotly.min.js",
    "!node_modules/mapbox-gl/dist/**",
    "!node_modules/mapbox-gl/src/**",
    "node_modules/mapbox-gl/dist/mapbox-gl.js",
    "!node_modules/xterm/src/**"
];

(async function () {
    const config = {
        appId: manifestJson.appId,
        copyright: manifestJson.copyright,
        productName,

        nodeGypRebuild: false,
        npmRebuild: false,
        buildDependenciesFromSource: true,

        files,

        extraResources: await getExtraResource(),

        mac: {
            target: [
                {
                    target: "dmg",
                    arch: ["x64"]
                },
                {
                    target: "pkg",
                    arch: ["x64"]
                },
                {
                    target: "zip",
                    arch: ["x64"]
                }
            ],
            category: manifestJson.mac.category,
            bundleVersion: manifestJson.version,
            icon: "./icon.icns",
            type: "distribution"
        },

        dmg: {
            background: "resources/background.png",
            iconSize: 160,
            iconTextSize: 12,
            window: {
                width: 660,
                height: 400
            },
            contents: [
                {
                    x: 180,
                    y: 170,
                    type: "file"
                },
                {
                    x: 480,
                    y: 170,
                    type: "link",
                    path: "/Applications"
                }
            ]
        },

        pkg: {
            license: "LICENSE.TXT"
        },

        win: {
            target: ["nsis"], // [, "squirrel", "portable", "zip"],
            icon: "./resources/icon.ico"
        },

        nsis: {
            installerIcon: "./resources/icon.ico",
            license: "LICENSE.TXT",
            warningsAsErrors: false,
            shortcutName: productName
        },

        linux: {
            target:
                process.arch == "arm"
                    ? [{ target: "deb", arch: ["armv7l"] }]
                    : ["deb", "AppImage", "rpm"],
            icon: "./resources/icon.icns",
            category: "Utility",
            synopsis: manifestJson.synopsis,
            description: manifestJson.description
        }
    };

    const configYAML = YAML.stringify(config);
    fs.writeFileSync("electron-builder.yml", configYAML);
})();
