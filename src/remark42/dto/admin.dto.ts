// EventType indicates type of the event
export type EventType = number;

// enum of all event types
export const EvCreate: EventType = 0;
export const EvDelete: EventType = 1;
export const EvUpdate: EventType = 2;
export const EvVote: EventType = 3;

// DTOs
export type KeyRequest = string;
export type KeyResponse = string;

export type AdminsRequest = string;
export type AdminsResponse = string[];

export type EmailRequest = string;
export type EmailResponse = string;

export type EnabledRequest = string;
export type EnabledResponse = boolean;

export type OnEventRequest = [string, EventType];
export type OnEventResponse = void;
