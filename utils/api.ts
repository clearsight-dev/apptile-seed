import axios from 'axios';
import { IForkWithBranches, IManifestResponse, IAppDraftResponse, ILastSavedConfigResponse, IOtaSnapshotResponse, IPushLogsResponse, ICommitResponse } from '../types/type';
import {getConfigValue} from 'apptile-core';

export async function fetchBranchesApi(appId: string | number, forkId: string | number): Promise<IForkWithBranches> {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branches`;
  const response = await axios.get<IForkWithBranches>(url);
  return response.data;
}

export async function fetchManifestApi(appId: string | number) {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/manifest`;
  const response = await axios.get<IManifestResponse>(url);
  return response.data;
}

export async function fetchAppDraftApi(appId: string | number, forkId: string | number, branchName: string) {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/fork/${forkId}/branch/${branchName}/PreviewAppDraft`;
  try {
    const response = await axios.get<IAppDraftResponse>(url);
    return response.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      return { notFound: true };
    }
    throw err;
  }
}

export async function fetchPushLogsApi(appId: string | number): Promise<IPushLogsResponse> {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/pushLogs`;
  const response = await axios.get<IPushLogsResponse>(url);
  return response.data;
}

export async function fetchLastSavedConfigApi(appId: string | number, forkId: string | number, branchName: string): Promise<ILastSavedConfigResponse> {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/${appId}/${forkId}/${branchName}/noRedirect`;
  const response = await axios.get(url);
  return response.data;
}

export async function fetchCommitApi(commitId: string | number): Promise<ICommitResponse> {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/commit/${commitId}`;
  const response = await axios.get<ICommitResponse>(url);
  return response.data;
}

export async function fetchOtaSnapshotsApi(forkId: string | number): Promise<IOtaSnapshotResponse> {
  const APPTILE_API_ENDPOINT = await getConfigValue('APPTILE_API_ENDPOINT');
  const url = `${APPTILE_API_ENDPOINT}/api/v2/app/ota/fork/${forkId}/appSnapshot`;
  const response = await axios.get<IOtaSnapshotResponse>(url);
  return response.data;
}