import { NotificationCategory } from "../types/notification-categories";
import { NotificationTiming } from "../types/notification-timing";

const TIMING_CONFIGS: Record<NotificationCategory, NotificationTiming> = {
  daily_verse: {
    category: 'daily_verse',
    cooldownHours: 24,
    checkField: 'daily_verse_last_delivery_at'
  },
  daily_chapter: {
    category: 'daily_chapter', 
    cooldownHours: 24,
    checkField: 'daily_chapter_last_delivery_at'
  },
  prayer_times: {
    category: 'prayer_times',
    cooldownHours: 1,
    checkField: 'prayer_times_last_delivery_at'
  }
};

export function shouldBlockNotification(
  notificationData: any,
  category: NotificationCategory,
  force: boolean = false
): boolean {
  if (force) return false;
  
  const config = TIMING_CONFIGS[category];
  const lastDeliveryTime = notificationData?.[config.checkField];
  
  if (!lastDeliveryTime) return false;
  
  const cooldownMs = config.cooldownHours * 60 * 60 * 1000;
  const cooldownThreshold = new Date(Date.now() - cooldownMs);
  const lastDelivery = new Date(lastDeliveryTime);

  return lastDelivery > cooldownThreshold;
}

export function createUpdateData(
  category: NotificationCategory,
  newTimestamp: string
): any {
  const config = TIMING_CONFIGS[category];
  const updateData: any = {
    last_delivery_at: newTimestamp,
    [config.checkField]: newTimestamp // Add category-specific timestamp
  };
  
  return updateData;
}

export function getLastDeliveryTime(
  notificationData: any,
  category: NotificationCategory
): string | null {
  const config = TIMING_CONFIGS[category];
  return notificationData?.[config.checkField] || null;
}
