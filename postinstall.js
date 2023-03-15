const fs = require("fs");
const fse = require("fs-extra");

const FOLDERS = ["packages", "libs", "resources"];

// packages
fs.readdirSync("packages").forEach(folder => {
    if (folder != "standalone" && fs.existsSync(`packages/${folder}`)) {
        console.log(`Remove packages/${folder} ...`);
        fse.removeSync(`packages/${folder}`);
    }
});
fs.readdirSync("node_modules/eez-studio/packages").forEach(folder => {
    // libs
    console.log(
        `Copy node_modules/eez-studio/packages/${folder} to packages/${folder} ...`
    );
    fse.copySync(
        `node_modules/eez-studio/packages/${folder}`,
        `packages/${folder}`
    );
});

// libs
console.log(`Copy node_modules/eez-studio/libs to libs ...`);
try {
    fse.removeSync("libs");
} catch (err) {}
fse.copySync("node_modules/eez-studio/libs", `libs`);

// resources
console.log(
    `Copy node_modules/eez-studio/resources/expression-grammar.pegjs to resources ...`
);
fse.copySync(
    "node_modules/eez-studio/resources/expression-grammar.pegjs",
    `resources/expression-grammar.pegjs`
);
