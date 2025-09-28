import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { NotificationReceiver } from "../types/notification-receiver";
import { supabase } from "../utils/supabase-client";

export class NotificationReceivers { 
    static instance = new NotificationReceivers();

    // Latest receivers
    public receivers: NotificationReceiver[] = [];

    // Subscription to the receivers changes
    private subscription: any = null;
    private reconnectInterval: NodeJS.Timeout | null = null;
    private isSubscribed = false;
    
    async initialize() { 
        this.receivers = await this.getReceivers();
    }

    async getReceivers(): Promise<NotificationReceiver[]> {
        try {
            const { data, error } = await supabase().from('ws-notifications').select('*');
    
            if (error) {
                console.error(`Error getting receivers: ${error.message}`);
                return [];
            }
    
            if (!data || data.length === 0) {
                console.log('No receivers found');
                return [];
            }
    
            console.log(`Found ${data.length} receivers`);
            return data as NotificationReceiver[];
        } catch (error) {
            console.error('Exception while getting receivers:', error);
            return [];
        }
    }

    async subscribeToChanges() {
        try {
            // Clean up existing subscription if any
            if (this.subscription) {
                await this.unsubscribe();
            }

            console.log('Setting up real-time subscription to receivers...');

            this.subscription = supabase()
                .channel('ws-notifications-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'ws-notifications'
                    },
                    async (payload) => {
                        console.log('Received database change:', payload.eventType);
                        await this.handleDatabaseChange(payload);
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Successfully subscribed to receivers changes');
                        this.isSubscribed = true;
                        this.clearReconnectInterval();
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('Subscription error, will retry...');
                        this.isSubscribed = false;
                        this.scheduleReconnect();
                    } else if (status === 'CLOSED') {
                        console.warn('Subscription closed, will retry...');
                        this.isSubscribed = false;
                        this.scheduleReconnect();
                    }
                });

            // Set up heartbeat to prevent timeouts
            this.setupHeartbeat();

        } catch (error) {
            console.error('Error setting up subscription:', error);
            this.scheduleReconnect();
        }
    }

    private async handleDatabaseChange(payload: RealtimePostgresChangesPayload<{
        [key: string]: any;
    }>) {
        try {
            const { eventType, new: newRecord, old: oldRecord } = payload;

            switch (eventType) {
                case 'INSERT':
                    console.log('➕ New notification receiver added:', newRecord?.['device_token']);
                    await this.refreshReceivers();
                    break;

                case 'UPDATE':
                    console.log('🔄 Notification receiver updated:', newRecord?.['device_token']);
                    await this.refreshReceivers();
                    break;

                case 'DELETE':
                    console.log('➖ Receiver deleted:', oldRecord?.['device_token']);
                    await this.refreshReceivers();
                    break;

                default:
                    break;
            }
        } catch (error) {
            console.error('Error handling ws-notifications database change:', error);
        }
    }

    private async refreshReceivers() {
        try {
            const newReceivers = await this.getReceivers();
            this.receivers = newReceivers;
            console.log(`🔄 Receivers updated: ${this.receivers.length} total`);
        } catch (error) {
            console.error('Error refreshing receivers:', error);
        }
    }

    private scheduleReconnect() {
        if (this.reconnectInterval) return; // Already scheduled

        console.log('Scheduling reconnection in 5 seconds...');
        this.reconnectInterval = setTimeout(async () => {
            this.reconnectInterval = null;
            if (!this.isSubscribed) {
                console.log('🔄 Attempting to reconnect...');
                await this.subscribeToChanges();
            }
        }, 5000);
    }

    private clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    private setupHeartbeat() {
        setInterval(async () => {
            if (!this.isSubscribed || !this.subscription) {
                console.log('Heartbeat: Connection lost, attempting to reconnect...');
                try {
                    await this.subscribeToChanges();
                } catch (error) {
                    console.error('Heartbeat reconnection failed:', error);
                }
            } else {
                // Ping the connection to ensure it's alive
                try {
                    await supabase().from('ws-notifications').select('count').limit(1).single();
                } catch (error) {
                    console.warn('Heartbeat: Connection test failed, will reconnect on next heartbeat');
                    this.isSubscribed = false;
                }
            }
        }, 30000); // 30 seconds
    }

    async unsubscribe() {
        try {
            if (this.subscription) {
                await supabase().removeChannel(this.subscription);
                this.subscription = null;
                this.isSubscribed = false;
                console.log('Unsubscribed from receivers changes');
            }
            this.clearReconnectInterval();
        } catch (error) {
            console.error('Error unsubscribing:', error);
        }
    }

    // Graceful shutdown
    async shutdown() {
        console.log('Shutting down NotificationReceivers...');
        await this.unsubscribe();
        this.clearReconnectInterval();
    }
}