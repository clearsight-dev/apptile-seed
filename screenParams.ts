import { IFork, IForkWithBranches } from "./types/type";

export type ScreenParams = {
  PreviewHome: undefined,
  Scanner: undefined,
  Fork: {
    appId: string;
    forks: IFork[];
  },
  Branch: {
    appId: string;
    branches: IForkWithBranches['branches'];
    forkId: number;
    appName?: string;
    forkName: string;
    backTitle?: string;
  },
  AppDetail: {
    appId: string;
    forkId: number;
    branchName: string;
    branchTitle?: string;
    branchId?: number;
    forkName: string;
    backTitle?: string;
  }
};