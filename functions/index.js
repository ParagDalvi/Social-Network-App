const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
exports.onCreateFollower = functions.firestore
  .document("/followers/{userId}/usersFollowers/{followerId}")
  .onCreate(async (snapshot, context) => {
    console.log("Follower Created", snapshot.id);
    const userId = context.params.userId;
    const followerId = context.params.followerId;

    // 1) Create followed users posts ref
    const followedUserPostsRef = admin
      .firestore()
      .collection("posts")
      .doc(userId)
      .collection("usersPosts");

    // 2) Create following user's timeline ref
    const timelinePostsRef = admin
      .firestore()
      .collection("timeline")
      .doc(followerId)
      .collection("timelinePosts");

    // 3) Get followed users posts
    const querySnapshot = await followedUserPostsRef.get();

    // 4) Add each user post to following user's timeline
    querySnapshot.forEach(doc => {
      if (doc.exists) {
        const postId = doc.id;
        const postData = doc.data();
        timelinePostsRef.doc(postId).set(postData);
      }
    });
  });


exports.onDeleteFollower = functions.firestore
  .document("/followers/{userId}/usersFollowers/{followerId}")
  .onDelete(async (snapshot, context) => {
    console.log("Follower deleted", snapshot.id);

    const userId = context.params.userId;
    const followerId = context.params.followerId;

    const timelinePostsRef = admin
      .firestore()
      .collection("timeline")
      .doc(followerId)
      .collection("timelinePosts")
      .where("ownerId", "==", userId);

    const querySnapshot = await timelinePostsRef.get();
    querySnapshot.forEach(doc => {
      if (doc.exists) {
        doc.ref.delete();
      }
    });
  });


exports.onCreatePost = functions.firestore.document('/posts/{userId}/usersPosts/{postId}')
  .onCreate(async (snapshot, context) => {
    const postCreated = snapshot.data();
    const userId = context.params.userId;
    const postId = context.params.postId;

    //get all followers of the user who made the post
    const userFollowerRef = admin.firestore().collection('followers')
      .doc(userId)
      .collection('usersFollowers');

    //add new post to each follower's timeline
    const querySnapshot = await userFollowerRef.get();
    querySnapshot.forEach(doc => {
      const followerId = doc.id;
      admin.firestore().collection('timeline')
        .doc(followerId)
        .collection('timelinePosts')
        .doc(postId).set(postCreated);
    });
  });


exports.onUpdatePosts = functions.firestore.document('/posts/{userId}/usersPosts/{postId}')
  .onUpdate(async (change, context) => {
    const postUpdated = change.after.data();
    const userId = context.params.userId;
    const postId = context.params.postId;

    //get all followers of the user who made the post
    const userFollowerRef = admin.firestore().collection('followers')
      .doc(userId)
      .collection('usersFollowers');

    //update each post to each follower's timeline
    const querySnapshot = await userFollowerRef.get();
    querySnapshot.forEach(doc => {
      const followerId = doc.id;
      admin.firestore().collection('timeline')
        .doc(followerId)
        .collection('timelinePosts')
        .doc(postId).get().then(doc => {
          if (doc.exists) {
            doc.ref.update(postUpdated);
          }
        });
    });

  });



exports.onDeletePosts = functions.firestore.document('/posts/{userId}/usersPosts/{postId}')
  .onDelete(async (snapshot, context) => {
    const userId = context.params.userId;
    const postId = context.params.postId;

    //get all followers of the user who made the post
    const userFollowerRef = admin.firestore().collection('followers')
      .doc(userId)
      .collection('usersFollowers');

    //delete each post to each follower's timeline
    const querySnapshot = await userFollowerRef.get();
    querySnapshot.forEach(doc => {
      const followerId = doc.id;
      admin.firestore().collection('timeline')
        .doc(followerId)
        .collection('timelinePosts')
        .doc(postId).get().then(doc => {
          if (doc.exists) {
            doc.ref.delete();
          }
        });
    });
  });



exports.onCreateActivityFeedItem = functions.firestore.document('/feeds/{userId}/feedItems/{activityFeedItem}')
  .onCreate(async (snapshot, context) => {
    console.log("Activity feed log created", snapshot.data);

    //get user connected to the feed
    const userId = context.params.userId;
    const userRef = admin.firestore().doc(`users/${userId}`);
    const doc = await userRef.get();

    //once we have user, check if they have a notification token and send notificatin if have token
    const androidNotificationToken = doc.data().androidNotificationToken;
    const createdActivityFeedItem = snapshot.data();
    if (androidNotificationToken) {
      //send notificaton
      sendNotification(androidNotificationToken, createdActivityFeedItem);
    }
    else {
      console.log("No token for user, cannot send notification");
    }

    function sendNotification(androidNotificationToken, activityFeedItem) {
      let body;
      switch (activityFeedItem.type) {
        case "comment":
          body = `${activityFeedItem.username} replied: ${activityFeedItem.commentData}`;
          break;
        case "like":
          body = `${activityFeedItem.username} liked your post`;
          break;
        case "follow":
          body = `${activityFeedItem.username} started following you`;
          break;
        default:
          break;
      }

      //create msg for notification
      const message = {
        notification: { body },
        token: androidNotificationToken, 
        data: { recipient: userId }
      };

      //send msg with admin.messaging()
      admin.messaging().send(message).then(response => {
        console.log("Message sent sucessfully", response);
      }).catch(error => {
        console.log("Error sending message", error);
      });
    }
  });
