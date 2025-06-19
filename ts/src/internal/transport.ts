export interface Transport {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendRequest(messages: any[], options: Record<string, any>): Promise<void>;
    receiveMessages(): AsyncIterable<Record<string, any>>;
    isConnected(): boolean;
}
