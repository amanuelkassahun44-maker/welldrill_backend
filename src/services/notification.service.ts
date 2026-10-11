import { messaging } from '../config/firebase';

export async function sendPushNotification(
  fcmToken: string,
  notification: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title: notification.title, body: notification.body },
      data: notification.data || {},
      android: { priority: 'high', notification: { sound: 'default', channelId: 'welldrill_main' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (err) {
    console.error('Push notification failed:', err);
  }
}

export async function sendToTopic(topic: string, notification: { title: string; body: string; data?: Record<string, string> }) {
  try {
    await messaging.send({
      topic, notification: { title: notification.title, body: notification.body }, data: notification.data || {},
    });
  } catch (err) { console.error('Topic notification failed:', err); }
}
