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
    private isReconnecting = false;
    
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
        // Prevent multiple simultaneous reconnection attempts
        if (this.isReconnecting) {
            console.log('Reconnection already in progress, skipping...');
            return;
        }

        try {
            this.isReconnecting = true;
            
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
                        console.log('✅ Successfully subscribed to receivers changes');
                        this.isSubscribed = true;
                        this.isReconnecting = false;
                        this.clearReconnectInterval();
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Subscription error, will retry in 30 seconds...');
                        this.isSubscribed = false;
                        this.isReconnecting = false;
                        this.scheduleReconnect();
                    } else if (status === 'CLOSED') {
                        console.warn('⚠️ Subscription closed, will retry in 30 seconds...');
                        this.isSubscribed = false;
                        this.isReconnecting = false;
                        this.scheduleReconnect();
                    }
                });

            // Set up heartbeat to prevent timeouts
            this.setupHeartbeat();

        } catch (error) {
            console.error('Error setting up subscription:', error);
            this.isReconnecting = false;
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

        console.log('⏰ Scheduling reconnection in 30 seconds...');
        this.reconnectInterval = setTimeout(async () => {
            this.reconnectInterval = null;
            if (!this.isSubscribed && !this.isReconnecting) {
                console.log('🔄 Attempting scheduled reconnection...');
                await this.subscribeToChanges();
            }
        }, 30000); // 30 seconds instead of 5
    }

    private clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    private setupHeartbeat() {
        // Much less frequent heartbeat to avoid log spam
        setInterval(async () => {
            if (!this.isSubscribed && !this.isReconnecting && !this.reconnectInterval) {
                console.log('Heartbeat: Connection lost, attempting to reconnect...');
                try {
                    await this.subscribeToChanges();
                } catch (error) {
                    console.error('Heartbeat reconnection failed:', error);
                }
            }
        }, 300000); // 5 minutes
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