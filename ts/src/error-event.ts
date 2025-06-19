interface ErrorEventInit extends EventInit {
    message?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    error?: unknown;
}

export class ErrorEvent extends Event {
    readonly message: string;
    readonly filename: string;
    readonly lineno: number;
    readonly colno: number;
    readonly error: unknown;

    constructor(type: string, init: ErrorEventInit = {}) {
        super(type, init);
        this.message = init.message ?? "";
        this.filename = init.filename ?? "";
        this.lineno = init.lineno ?? 0;
        this.colno = init.colno ?? 0;
        this.error = init.error ?? null;
    }
}
