const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const FILES_API_BASE = `${API_BASE_URL}/data/v4`;
const TENANT_ID = import.meta.env.VITE_TENANT_ID || '';
const FILES_MODULE_NAME = Number(import.meta.env.VITE_FILES_MODULE_NAME || '3');
const FILES_PARENT_DIRECTORY_ID =
  import.meta.env.VITE_FILES_PARENT_DIRECTORY_ID || '';

export interface PreSignedUploadResponse {
  isSuccess: boolean;
  errors?: Record<string, string>;
  uploadUrl?: string;
  fileId?: string;
}

export interface GetPreSignedUrlOptions {
  name: string;
  projectKey?: string;
  metaData?: string;
  parentDirectoryId?: string;
  tags?: string;
  accessModifier?: string;
  configurationName?: string;
}

export async function getPreSignedUploadUrl(
  options: GetPreSignedUrlOptions,
): Promise<PreSignedUploadResponse> {
  const body = {
    name: options.name,
    projectKey: options.projectKey || TENANT_ID,
    configurationName: options.configurationName ?? 'Default',
    accessModifier: options.accessModifier ?? 'Public',
    metaData: options.metaData ?? '',
    parentDirectoryId: options.parentDirectoryId ?? FILES_PARENT_DIRECTORY_ID,
    tags: options.tags ?? '',
    moduleName: FILES_MODULE_NAME,
  };

  const response = await fetch(`${FILES_API_BASE}/Files/GetPreSignedUrlForUpload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-blocks-key': TENANT_ID,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to get upload URL (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as PreSignedUploadResponse;
  if (!json.isSuccess || !json.uploadUrl || !json.fileId) {
    const errMsg = json.errors ? Object.values(json.errors).join(', ') : 'Unknown error';
    throw new Error(`Could not get upload URL: ${errMsg}`);
  }
  return json;
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-ms-blob-type': 'BlockBlob',
    },
  });

  if (!response.ok && response.status !== 0) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `File upload failed (${response.status}): ${text || response.statusText}`,
    );
  }
}

export interface FileResponse {
  url?: string | null;
  itemId?: string | null;
  isSuccess?: boolean;
  errors?: Record<string, string> | null;
  name?: string | null;
  [key: string]: unknown;
}

export async function getFiles(
  fileIds: string[],
  configurationName?: string,
): Promise<FileResponse[]> {
  if (fileIds.length === 0) return [];

  const response = await fetch(`${FILES_API_BASE}/Files/GetFiles`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-blocks-key': TENANT_ID,
    },
    body: JSON.stringify({
      fileIds,
      configurationName: configurationName ?? 'Default',
      projectKey: TENANT_ID || undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to load files (${response.status}): ${text || response.statusText}`,
    );
  }

  const json = (await response.json()) as FileResponse[];
  return Array.isArray(json) ? json : [];
}