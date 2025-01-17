import 'package:cloud_firestore/cloud_firestore.dart';

class User {
  final String id, username, email, photoUrl, displayName, bio;

  User({this.id, this.username, this.email, this.photoUrl, this.displayName, this.bio});

  factory User.fromDocument(DocumentSnapshot doc){
    return User(
      id: doc['id'],
      email: doc['email'],
      username: doc['username'],
      photoUrl: doc['photoUrl'],
      displayName: doc['displayName'],
      bio: doc['bio'],
    );
  }

}
