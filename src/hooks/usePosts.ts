import { useInfiniteQuery } from "@tanstack/react-query";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import type { Post } from "../types";

const POSTS_PER_PAGE = 10;

interface FirestorePost {
  id: string;
  text: string;
  createdAt: Timestamp;
  media?: { type: "image"; url: string }[];
  authorId: string;
  authorName: string;
  likes?: string[];
  comments?: any[];
}

const fetchPosts = async ({
  pageParam,
  tab,
}: {
  pageParam?: any;
  tab: string;
}) => {
  let q;
  if (pageParam) {
    q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      startAfter(pageParam),
      limit(POSTS_PER_PAGE)
    );
  } else {
    q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(POSTS_PER_PAGE)
    );
  }

  const snapshot = await getDocs(q);
  const lastVisible = snapshot.docs[snapshot.docs.length - 1];

  const posts: Post[] = snapshot.docs.map((doc) => {
    const data = doc.data() as FirestorePost;
    return {
      id: doc.id,
      channel: {
        id: data.authorId, // или можно оставить "default", но лучше использовать authorId
        name: data.authorName || "Пользователь",
        avatar: data.authorPhotoURL || null,
      },
      text: data.text,
      publishedAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
      media: data.media || [],
      likes: data.likes || [],
      commentsCount: data.commentsCount || 0,
      shares: 0,
    };
  });

  return {
    posts,
    nextPage: lastVisible,
    total: 0,
  };
};

export const usePosts = (tab: "subscriptions" | "recommendations") => {
  return useInfiniteQuery({
    queryKey: ["posts", tab],
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, tab }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: null,
    staleTime: 0, // чтобы сразу видеть новые посты
  });
};