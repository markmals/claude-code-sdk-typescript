export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | { [key: string]: JSONValue };

export interface Transport {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendRequest(messages: JSONValue[], options: JSONValue): Promise<void>;
    receiveMessages(): AsyncIterable<JSONValue>;
    isConnected(): boolean;
}
