// @ts-ignore
import configuration from "../main.config.js";

export interface Configuration {
    /**
     * Public URL of server only.
     * @deprecated, use baseName. If baseName is set, then host is baseName + "/api"
     */
    host?: string;

    /**
     * Base name of the whole application, i.e. URL to the main page of Dataspecer.
     * Deprecates host.
     * Must not end with a slash.
     */
    baseName?: string;

    /**
     * Static files path.
     * Works only with baseName.
     */
    staticFilesPath?: string;

    // Local port to listen on
    port: number;

    // Max payload limit for stores PUSH operation
    payloadSizeLimit: string;

    // Root used for v1 dataspecer
    v1RootIri: string;
    v1RootMetadata: object;

    // Root used for local models
    localRootIri: string;
    localRootMetadata: object;

    // Generator configuraion
    configuration: object;

    /**
     * Optional Model Context Protocol server configuration.
     */
    mcp?: {
        enabled?: boolean;
        basePath?: string;
        authSecret?: string;
    };
}

const defaultConfiguration = {
    payloadSizeLimit: "64mb",
    v1RootIri: "http://dataspecer.com/packages/local-root",
    v1RootMetadata: {
        label: {
            cs: "Datové specifikace z core@v.1",
            en: "Data specifications from core@v.1"
        },
        description: {
            cs: "Tato složka obsahuje všechny datové specifikace se kterými dokáže pracovat manažer specifikací z core@v.1.",
            en: "This folder contains all data specifications that can be managed by the data specification manager from core@v.1."
        }
    },

    localRootIri: "http://dataspecer.com/packages/local-root",
    localRootMetadata: {
        label: {
            cs: "Lokální modely",
            en: "Local models"
        },
    },

    mcp: {
        enabled: false,
    },
} as Partial<Configuration>

const envConfiguration = {} as Partial<Configuration>;
if (process.env.HOST) {
    envConfiguration.host = process.env.HOST;
}
if (process.env.BASE_NAME) {
    envConfiguration.baseName = process.env.BASE_NAME;
}
if (process.env.STATIC_FILES_PATH) {
    envConfiguration.staticFilesPath = process.env.STATIC_FILES_PATH;
}
if (process.env.PORT) {
    envConfiguration.port = Number(process.env.PORT);
}

// MCP configuration from environment
const envMcp: NonNullable<Configuration["mcp"]> = {};
if (process.env.MCP_ENABLED) {
    envMcp.enabled = ["1", "true", "yes"].includes(String(process.env.MCP_ENABLED).toLowerCase());
}
if (process.env.MCP_BASE_PATH) {
    envMcp.basePath = process.env.MCP_BASE_PATH;
}
if (process.env.MCP_AUTH_SECRET) {
    envMcp.authSecret = process.env.MCP_AUTH_SECRET;
}
if (Object.keys(envMcp).length > 0) {
    const currentMcp = (envConfiguration.mcp ?? {}) as NonNullable<Configuration["mcp"]>;
    envConfiguration.mcp = { ...currentMcp, ...envMcp };
}

export default ({...defaultConfiguration, ...configuration, ...envConfiguration} as Configuration);
