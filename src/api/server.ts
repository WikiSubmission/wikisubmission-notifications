import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyFormbody from "@fastify/formbody";
import { getFileExports } from "../utils/get-file-exports";
import { WRoute } from "../types/w-route";

export class Server {
    static instance = new Server();

    server: FastifyInstance;

    port = parseInt(process.env["PORT"] || "8080");

    private routeCache = new Map<string, {
        data: any;
        timestamp: number;
    }>();

    constructor() {
        this.server = Fastify({
            logger: {
                enabled: true,
                transport: {
                    targets: [
                        // [Pino Pretty - Pretty logs]
                        {
                            target: "pino-pretty",
                            options: {
                                translateTime: true,
                                ignorePaths: ["req.headers", "req.body"],
                                colorize: true,
                                singleLine: true,
                                messageFormat:
                                    "{msg}{if req} [{req.id}] {req.method} \"{req.url}\"{end}{if res} [{res.id}] {res.statusCode} ({res.responseTime}ms){end}",
                            },
                            level: "warn",
                        },
                    ],
                },
                serializers: {
                    // [Request Serializer]
                    req(request) {
                        return {
                            url: request.url,
                            method: request.method,
                            id: request.id,
                            ip: request.ip,
                        };
                    },
                    // [Response Serializer]
                    res(reply) {
                        return {
                            statusCode: reply.statusCode,
                            id: reply.request?.id || "--",
                            responseTime: reply.elapsedTime?.toFixed(1) || 0,
                        };
                    },
                },
            }
        });
    }

    // [Start]
    async start() {
        this.server.log.info(`=== Starting ===`);
        this.registerPlugins();
        await this.registerRoutes();
        await this.server.listen({ port: this.port, host: "0.0.0.0" });
    }

    // [Stop]
    async stop() {
        await this.server.close();
    }

    // [Register Routes]
    async registerRoutes() {
        const routes = await getFileExports<WRoute>("/api/routes");
        if (routes.length === 0) {
            this.server.log.warn(`No routes found`);
            return;
        }
        this.server.log.info(`${routes.length} routes: ${routes.map(r => `${r.url}`).join(", ")}`);
        for (const route of routes) {
            try {

                if (route.cache) {
                    if (route.cache) {
                        const cacheDuration = this.convertCacheDuration(route.cache.duration, route.cache.durationType);

                        // Store original handler
                        const originalHandler = route.handler;

                        // Add onSend hook to capture and cache the response
                        route.onSend = async (request, reply, payload) => {
                            if (reply.statusCode >= 200 && reply.statusCode < 300) {
                                try {
                                    let payloadString = '';
                                    if (payload) {
                                        if (typeof payload === 'string') {
                                            payloadString = payload;
                                        } else if (Buffer.isBuffer(payload)) {
                                            payloadString = payload.toString('utf8');
                                        } else if (typeof payload === 'object') {
                                            payloadString = JSON.stringify(payload);
                                        } else {
                                            payloadString = String(payload);
                                        }
                                    }
                                    const responseData = JSON.parse(payloadString);

                                    // Use custom cache key if set by handler, otherwise fall back to default
                                    const cacheKey = (request as any).customCacheKey || `${request.method}:${request.url}`;

                                    // Store the actual response data for caching
                                    this.routeCache.set(cacheKey, {
                                        data: responseData,
                                        timestamp: Date.now()
                                    });
                                } catch (error) {
                                    console.log(`Failed to parse response for caching:`, error);
                                }
                            }

                            return payload;
                        };

                        // Wrap handler with server-side caching
                        route.handler = async (request, reply) => {
                            const now = Date.now();

                            // Default cache key, can be overridden by handler
                            let cacheKey = `${request.method}:${request.url}`;

                            const cacheEntry = this.routeCache.get(cacheKey);

                            // Check if we have valid cached data
                            if (cacheEntry && (now - cacheEntry.timestamp) < (cacheDuration * 1000)) {

                                // Return cached data with cache metadata
                                const response = {
                                    ...cacheEntry.data,
                                    _cached: true,
                                    _cache_age: Math.floor((now - cacheEntry.timestamp) / 1000)
                                };

                                return reply.send(response);
                            }

                            // Store the cache key in request context for handler to potentially modify
                            (request as any).customCacheKey = cacheKey;

                            // Call original handler
                            return await originalHandler.call(this.server, request, reply);
                        };
                    }
                }

                this.server.route(route);
            } catch (error) {
                this.server.log.error(`Error registering route ${route.url}: ${error}`);
            }
        }
    }

    // [Register Plugins]
    async registerPlugins() {
        // [CORS - Allow all origins]
        this.server.register(fastifyCors, { origin: "*" });

        // [Helmet - Security]
        this.server.register(fastifyHelmet, { global: true });

        // [Form Data Support]
        this.server.register(fastifyFormbody);
    }

    log(message: any) {
        this.server.log.info(message);
    }

    warn(message: any) {
        this.server.log.warn(message);
    }

    error(message: any, fatal: boolean = false) {
        this.server.log.error(message);
        if (fatal) {
            process.exit(1);
        }
    }

    // [Convert cache duration to seconds]
    private convertCacheDuration(duration: number, type: "seconds" | "minutes" | "hours" | "days"): number {
        switch (type) {
            case "seconds":
                return duration;
            case "minutes":
                return duration * 60;
            case "hours":
                return duration * 60 * 60;
            case "days":
                return duration * 24 * 60 * 60;
            default:
                return duration;
        }
    }
}
