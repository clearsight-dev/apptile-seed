export type HomeState = {
    appId: null | string;
    hasError: boolean;
    errorMessage: string;
    pushLogs: {
        logs: Array<{
            androidBundleId: null | number;
            appId: string;
            comment: string;
            createdAt: string;
            id: number;
            iosBundleId: null | number;
            navigatorsBundleId: null | number;
            pluginsBundleId: null | number;
            publishedCommitId: null | number;
            updatedAt: string;
        }>;
        artefacts: Array<{
            id: number;
            type: "ios-jsbundle" | "android-jsbundle" | "navigator-bundle" | "plugin-bundle";
            cdnlink: string;
        }>;
    };
    manifest: {
        name: string;
        published: boolean;
        androidBundleId: null | number;
        iosBundleId: null | number;
        forks: Array<{
            id: string | number;
            title: string;
            publishedCommitId: number | null;
            mainBranchLatestSave: {
                commitId: number;
                cdnlink: string;
            };
        }>;
    };
    launchSequence: Array<{ label: string; status: "notstarted" | "inprogress" | "error" | "success" }>;
    showLaunchSequence: boolean;
};


export type DownloadNonCacheCodepushCb = (cdnlink: string, iosBundleId: number | null, androidBundleId: number | null) => Promise<void>;
export type DownloadCodepushCb = (publishedCommitId: number | null, iosBundleId: number | null, androidBundleId: number | null) => Promise<void>;