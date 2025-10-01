import { WRoute } from "../../types/w-route";
import { NotificationReceivers } from "../../notification-receivers";
import { generateDailyVerseNotification } from "../../notification-generators/daily-verse";
import { sendIOSNotification } from "../../utils/send-ios-notification";

export default function route(): WRoute {
    return {
        url: "/daily-verse",
        method: "POST",
        cache: {
            duration: 15,
            durationType: "seconds",
        },
        handler: async (request, reply) => {
            const { device_token } = request.body as { device_token: string };

            if (!device_token) {
                return reply.status(400).send({ error: "device_token is required in request body" });
            }

            try {
                const receiver = NotificationReceivers.instance.receivers.find(receiver => receiver.device_token === device_token);

                if (!receiver) {
                    return reply.status(400).send({ error: "Receiver not found" });
                }

                const result = await generateDailyVerseNotification(receiver, true);

                if (result) {
                    await sendIOSNotification(device_token, result);
                    return reply.status(200).send({
                        success: true,
                        content: result
                    });
                }

                return reply.status(500).send({ error: "No verse found" });
            } catch (error) {
                return reply.status(500).send({ error: error instanceof Error ? error.message : String(error) });
            }
        },
    }
}