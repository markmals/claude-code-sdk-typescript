type EventMapType = {
    [key: string]: Event;
};

export class GenericEventTarget<EventMap extends EventMapType> extends EventTarget {
    /* @ts-ignore */
    addEventListener<Key extends keyof EventMap & string>(
        type: Key,
        listener: ((event: EventMap[Key]) => void) | null,
        options?: EventListenerOptions | boolean,
    ): void {
        /* @ts-ignore */
        super.addEventListener(type, listener, options);
    }

    /* @ts-ignore */
    removeEventListener<Key extends keyof EventMap & string>(
        type: Key,
        listener: ((event: EventMap[Key]) => void) | null,
        options?: boolean | EventListenerOptions,
    ): void {
        /* @ts-ignore */
        super.removeEventListener(type, listener, options);
    }

    dispatchEvent<Key extends keyof EventMap>(event: EventMap[Key]): boolean {
        return super.dispatchEvent(event);
    }
}

export type GenericEventTargetConstructor<EventMap extends EventMapType> = {
    new (): GenericEventTarget<EventMap>;
    prototype: GenericEventTarget<EventMap>;
};
