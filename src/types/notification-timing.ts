import { NotificationCategory } from "./notification-categories";

export interface NotificationTiming {
    category: NotificationCategory;
    cooldownHours: number;
    checkField: string; // {category}_last_delivery_at
  }