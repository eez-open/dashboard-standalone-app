import "bootstrap";
import { resolve } from "path";
import fs from "fs";
import { ipcRenderer } from "electron";
import React from "react";
import { createRoot } from "react-dom/client";
import {
    configure,
    computed,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import { sourceRootDir } from "eez-studio-shared/util";
import { isDev } from "eez-studio-shared/util-electron";
import type { IExtension } from "eez-studio-shared/extensions/extension";
import {
    loadExtensions,
    installExtension
} from "eez-studio-shared/extensions/extensions";
import {
    getNodeModuleFolders,
    yarnInstall
} from "eez-studio-shared/extensions/yarn";

import * as notification from "eez-studio-ui/notification";

import "home/settings";

import {
    createInstrument,
    InstrumentObject,
    instruments
} from "instrument/instrument-object";

import { Editor, ProjectStore } from "project-editor/store";
import { ProjectEditorView } from "project-editor/project/ui/ProjectEditor";
import { ProjectContext } from "project-editor/project/context";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";
import { settingsController } from "home/settings";
import { RenderVariableStatus } from "project-editor/features/variable/global-variable-status";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PageEditor";
import {
    getObjectVariableTypeFromType,
    IObjectVariableValue
} from "project-editor/features/variable/value-type";

////////////////////////////////////////////////////////////////////////////////

const resourceFolderPath = isDev
    ? resolve(`${sourceRootDir()}/../resources`)
    : process.resourcesPath!;

const manifestJson = require(resourceFolderPath + "/manifest.json");

////////////////////////////////////////////////////////////////////////////////

const Main = observer(
    class Main extends React.Component<{ children: React.ReactNode }> {
        render() {
            return (
                <>
                    {this.props.children}
                    {notification.container}
                </>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const App = observer(
    class App extends React.Component {
        constructor(props: any) {
            super(props);

            projectEditorTab.loadProject();
        }

        render() {
            return projectEditorTab.render();
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class ProjectEditorTab {
    constructor(public filePath: string) {
        makeObservable(this, {
            error: observable,
            projectStore: observable,
            anyObjectVariableType: computed,
            loading: observable
        });
    }

    error: string | undefined;
    closed: boolean = false;
    loading = true;

    projectStore: ProjectStore | undefined;
    ProjectContext: React.Context<ProjectStore>;
    ProjectEditor: typeof ProjectEditorView;

    async loadProject() {
        try {
            this.ProjectContext = ProjectContext;

            this.ProjectEditor = ProjectEditorView;

            await initProjectEditor(undefined, ProjectEditorTab as any);
            if (closed) {
                return;
            }
            const projectEditorStore = await ProjectStore.create({
                type: "standalone"
            });
            if (closed) {
                return;
            }
            projectEditorStore.mount();

            await projectEditorStore.openFile(this.filePath);
            if (closed) {
                return;
            }

            if (closed) {
                return;
            }
            runInAction(() => {
                projectEditorStore.project._fullyLoaded = true;
            });

            runInAction(() => {
                this.projectStore = projectEditorStore;
                this.projectStore?.setRuntimeMode(false);
                this.loading = false;
            });

            setInterval(() => {
                if (!this.projectStore?.runtime) {
                    window.close();
                }
            });

            const onKeyDown = (e: KeyboardEvent) => {
                if (this.projectStore?.runtime) {
                    this.projectStore?.runtime.onKeyDown(e);
                }
            };
            document.addEventListener("keydown", onKeyDown);
        } catch (err) {
            console.log(err);
            runInAction(() => {
                this.error = "Failed to load file!";
            });
        }
    }

    get anyObjectVariableType() {
        if (!this.projectStore) {
            return false;
        }

        for (const variable of this.projectStore.project.allGlobalVariables) {
            if (
                getObjectVariableTypeFromType(this.projectStore, variable.type)
            ) {
                return true;
            }
        }

        return false;
    }

    get globalVariableStatuses() {
        const projectStore = this.projectStore;
        if (!projectStore) {
            return undefined;
        }

        let globalVariablesStatus: React.ReactNode[] = [];

        for (const variable of projectStore.project.allGlobalVariables) {
            const objectVariableType = getObjectVariableTypeFromType(
                projectStore,
                variable.type
            );
            if (objectVariableType) {
                let objectVariableValue: IObjectVariableValue | undefined =
                    projectStore.dataContext.get(variable.fullName);

                if (objectVariableValue) {
                    const managedValue =
                        objectVariableType.getValue(objectVariableValue);
                    if (managedValue) {
                        objectVariableValue = managedValue;
                    }
                }

                globalVariablesStatus.push(
                    <RenderVariableStatus
                        key={variable.fullName}
                        variable={variable}
                        value={objectVariableValue}
                        onClick={async () => {
                            if (objectVariableType.editConstructorParams) {
                                const constructorParams =
                                    await objectVariableType.editConstructorParams(
                                        variable,
                                        objectVariableValue?.constructorParams ||
                                            objectVariableValue,
                                        true
                                    );
                                if (constructorParams !== undefined) {
                                    projectStore.runtime!.setObjectVariableValue(
                                        variable.fullName,
                                        objectVariableType.createValue(
                                            constructorParams,
                                            true
                                        )
                                    );
                                }
                            }
                        }}
                    />
                );
            }
        }

        return globalVariablesStatus;
    }

    render() {
        const projectEditorStore = this.projectStore;
        const runtime = projectEditorStore?.runtime;

        if (!runtime) {
            return null;
        }

        return (
            <this.ProjectContext.Provider value={projectEditorStore}>
                <div className="EezStudio_ProjectEditorWrapper">
                    <div className="EezStudio_ProjectEditor_MainContentWrapper">
                        {this.anyObjectVariableType && (
                            <nav className="navbar justify-content-between EezStudio_ToolbarNav">
                                <div />
                                <div>{this.globalVariableStatuses}</div>
                            </nav>
                        )}

                        <PageEditor
                            editor={
                                new Editor(
                                    projectEditorStore,
                                    runtime.selectedPage,
                                    undefined,
                                    undefined,
                                    new PageTabState(runtime.selectedPage)
                                )
                            }
                        ></PageEditor>
                    </div>
                </div>
            </this.ProjectContext.Provider>
        );
    }

    async beforeAppClose() {
        if (this.projectStore) {
            await this.projectStore.closeWindow();
            this.projectStore = undefined;
            this.closed = true;
        }
        return true;
    }
}

const projectEditorTab = new ProjectEditorTab(
    resourceFolderPath + "/" + manifestJson.project
);

////////////////////////////////////////////////////////////////////////////////

export async function installExtensionsAndInstrument() {
    let extensionFileNames = await fs.promises.readdir(
        resourceFolderPath + "/extensions"
    );

    for (const extensionFileName of extensionFileNames) {
        const extensionFilePath =
            resourceFolderPath + "/extensions/" + extensionFileName;

        const extension = await installExtension(extensionFilePath, {
            notFound() {},
            async confirmReplaceNewerVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return true;
            },
            async confirmReplaceOlderVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return true;
            },
            async confirmReplaceTheSameVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return false;
            }
        });

        if (extension && extension.extensionType == "iext") {
            let foundInstrumentObject: InstrumentObject | undefined;

            instruments.forEach((instrumentObject: InstrumentObject) => {
                if (instrumentObject.instrumentExtensionId == extension!.id) {
                    foundInstrumentObject = instrumentObject;
                }
            });

            if (!foundInstrumentObject) {
                createInstrument(extension);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

// make sure we store all the values waiting to be stored inside blur event handler
function blurAll() {
    var tmp = document.createElement("input");
    document.body.appendChild(tmp);
    tmp.focus();
    document.body.removeChild(tmp);
}

async function beforeAppClose() {
    blurAll();

    if (!(await projectEditorTab.beforeAppClose())) {
        return false;
    }

    const {
        destroyExtensions
    } = require("eez-studio-shared/extensions/extensions");
    destroyExtensions();

    return true;
}

////////////////////////////////////////////////////////////////////////////////

async function main() {
    settingsController.switchTheme(manifestJson.theme == "dark");

    ipcRenderer.send("set-window-size", {
        width:
            (manifestJson.window?.width ?? 900) +
            (window.outerWidth - window.innerWidth) +
            2,
        height:
            (manifestJson.window?.height ?? 600) +
            (window.outerHeight - window.innerHeight) +
            2
    });

    let nodeModuleFolders: string[];
    try {
        nodeModuleFolders = await getNodeModuleFolders();
    } catch (err) {
        console.info(`Failed to get node module folders.`);
        nodeModuleFolders = [];
    }

    await loadExtensions(nodeModuleFolders);

    await installExtensionsAndInstrument();

    setTimeout(yarnInstall, 1000);

    const root = createRoot(document.getElementById("EezStudio_Content")!);
    root.render(
        <Main>
            <App />
        </Main>
    );
}

////////////////////////////////////////////////////////////////////////////////

configure({ enforceActions: "observed" });

ipcRenderer.on("reload", async () => {
    if (await beforeAppClose()) {
        ipcRenderer.send("reload");
    }
});

ipcRenderer.on("beforeClose", async () => {
    if (await beforeAppClose()) {
        ipcRenderer.send("readyToClose");
    }
});

main();
