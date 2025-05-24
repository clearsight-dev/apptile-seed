import axios from 'axios';
import {
  IForkWithBranches,
  IAppForksResponse,
  IManifestResponse,
  IAppDraftResponse,
  ILastSavedConfigResponse,
  IOtaSnapshotResponse,
  IPushLogsResponse,
  ICommitResponse,
} from '../types/type';
import {getConfigValue} from 'apptile-core';

export async function fetchForksApi(
  appId: string | number,
): Promise<IAppForksResponse> {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/forks`;
    const response = await axios.get<IAppForksResponse>(url);
    return response.data;
  } catch (error) {
    console.error(
      `[API] Error in fetchForksApi for appId:`,
      appId,
      `error:`,
      error,
    );
    throw error;
  }
}

export async function fetchBranchesApi(
  appId: string | number,
  forkId: string | number,
): Promise<IForkWithBranches> {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branches`;
    const response = await axios.get<IForkWithBranches>(url);
    return response.data;
  } catch (error) {
    console.error(
      `[API] Error in fetchBranchesApi for appId:`,
      appId,
      `forkId:`,
      forkId,
      `error:`,
      error,
    );
    throw error;
  }
}

export async function fetchManifestApi(
  appId: string | number,
): Promise<IManifestResponse> {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/manifest`;
    const response = await axios.get<IManifestResponse>(url);
    return response.data;
  } catch (error) {
    console.error(
      `[API] Error in fetchManifestApi for appId:`,
      appId,
      `error:`,
      error,
    );
    throw error;
  }
}

export async function fetchAppDraftApi(
  appId: string | number,
  forkId: string | number,
  branchName: string,
): Promise<IAppDraftResponse | {notFound: boolean}> {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branch/${branchName}/PreviewAppDraft`;
  try {
    const response = await axios.get<IAppDraftResponse>(url);
    return response.data;
  } catch (err: any) {
    console.error(
      `[API] Error in fetchAppDraftApi for appId:`,
      appId,
      `forkId:`,
      forkId,
      `branchName:`,
      branchName,
      `error:`,
      err,
    );
    if (err.response && err.response.status === 404) {
      console.warn(`[API] fetchAppDraftApi returned 404 for`, {
        appId,
        forkId,
        branchName,
      });
      return {notFound: true};
    }
    throw err;
  }
}

export async function fetchPushLogsApi(
  appId: string | number,
): Promise<IPushLogsResponse> {
  console.debug(`[API] Starting fetchPushLogsApi with appId:`, appId);
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/pushLogs`;
    const response = await axios.get<IPushLogsResponse>(url);
    return response.data;
  } catch (error) {
    console.error(
      `[API] Error in fetchPushLogsApi for appId:`,
      appId,
      `error:`,
      error,
    );
    throw error;
  }
}

export async function fetchLastSavedConfigApi(
  appId: string | number,
  forkId: string | number,
  branchName: string,
): Promise<ILastSavedConfigResponse> {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/${forkId}/${branchName}/noRedirect`;
    const response = await axios.get<ILastSavedConfigResponse>(url);
    return response.data;
  } catch (error) {
    console.error(
      `[API] Error in fetchLastSavedConfigApi for appId:`,
      appId,
      `forkId:`,
      forkId,
      `branchName:`,
      branchName,
      `error:`,
      error,
    );
    throw error;
  }
}

export async function fetchCommitApi(
  appId: string | number,
  commitId: string | number,
): Promise<ICommitResponse | null> {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/admin/api/v2/apps/${appId}/commits`;
    const response = await axios.get<ICommitResponse[]>(url);
    return response.data.find(commit => commit.id === commitId) || null;
  } catch (error) {
    console.error(
      `[API] Error in fetchCommitApi for appId:`,
      appId,
      `error:`,
      error,
    );
    throw error;
  }
}

export async function fetchOtaSnapshotsApi(
  forkId: string | number,
): Promise<IOtaSnapshotResponse> {
  try {
    const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
    const url = `${APPTILE_API_ENDPOINT}/api/v2/app/ota/fork/${forkId}/appSnapshot`;
    const response = await axios.get<IOtaSnapshotResponse>(url);
    return response.data;
  } catch (error) {
    console.error(
      `[API] Error in fetchOtaSnapshotsApi for forkId:`,
      forkId,
      `error:`,
      error,
    );
    throw error;
  }
}
