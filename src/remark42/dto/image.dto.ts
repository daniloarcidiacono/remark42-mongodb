import { Time } from '@util/time';

// StoreInfo contains image store meta information
export interface StoreInfo {
	FirstStagingImageTS: Time;
}

export type SaveRequest = [string, ArrayBuffer];
export type SaveResponse = void;

export type LoadRequest = string;
export type LoadResponse = ArrayBuffer | (string | undefined);

export type CommitRequest = string;
export type CommitResponse = void;

export type CleanupRequest = number;
export type CleanupResponse = void;

export type InfoRequest = void;
export type InfoResponse = StoreInfo;

export type ResetCleanupTimerRequest = string;
export type ResetCleanupTimerResponse = void;
