const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// 1. Initialize Express (Required to keep Render awake)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/ping', (req, res) => {
    res.status(200).send('Codex Vanguard Backend is awake');
});

// 2. Initialize Firebase Admin SDK
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("FATAL ERROR: FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

// 3. Database Listener
console.log("Starting Firestore listener for 'server_data' collection...");

let isFirstSnapshot = true;

db.collection('server_data').onSnapshot((snapshot) => {
    // Skip the initial load so old docs don't trigger notifications
    if (isFirstSnapshot) {
        isFirstSnapshot = false;
        console.log(`Initial snapshot loaded (${snapshot.size} existing docs), skipping notifications.`);
        return;
    }

    snapshot.docChanges().forEach((change) => {

        // Only trigger on newly added documents, not modified or deleted ones
        if (change.type === 'added') {
            const documentData = change.doc.data();
            console.log("New document detected:", documentData.id);

            // 4. Construct the Push Notification
            const message = {
                notification: {
                    title: "New Upload Available",
                    body: `Subject: ${documentData.subject || 'Update'} - ${documentData.fileName || 'New file'}`
                },
                android: {
                    priority: "high",
                    notification: { channelId: "global_updates_channel" }
                },
                topic: "global_updates"
            };

            // 5. Send the Notification via FCM
            getMessaging().send(message)
                .then((response) => {
                    console.log("Successfully sent notification:", response);
                })
                .catch((error) => {
                    console.error("Error sending notification:", error);
                });
        }
    });
}, (error) => {
    console.error("Error listening to Firestore:", error);
});

// 6. Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});