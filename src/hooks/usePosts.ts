// usePosts.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { db, auth } from "../lib/firebase";
import { collection, query, where, orderBy, limit, startAfter, getDocs } from "firebase/firestore";
import type { Post } from "../types";

const POSTS_PER_PAGE = 10;

const fetchPosts = async ({ pageParam, tab }: { pageParam?: any; tab: string }) => {
  const currentUser = auth.currentUser;

  let blockedIds: string[] = [];
  if (currentUser) {
    try {
      const blocksQuery = query(collection(db, "blocks"), where("blockerId", "==", currentUser.uid));
      const blocksSnapshot = await getDocs(blocksQuery);
      blockedIds = blocksSnapshot.docs.map(doc => doc.data().blockedId);
    } catch (error) { console.error("Ошибка загрузки блокировок:", error); }
  }

  const hideNsfw = localStorage.getItem('hideNsfw') === 'true';

  let q;
  if (pageParam) {
    q = query(collection(db, "posts"), orderBy("createdAt", "desc"), startAfter(pageParam), limit(POSTS_PER_PAGE));
  } else {
    q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE));
  }

  try {
    const snapshot = await getDocs(q);
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    const posts: Post[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          channel: { id: data.authorId, name: data.authorName || "Пользователь", avatar: data.authorPhotoURL || null },
          text: data.text || "",
          publishedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          media: data.media || [],
          likes: data.likes || [],
          commentsCount: data.commentsCount || 0,
          shares: 0,
          pinned: data.pinned || false,
          nsfw: data.nsfw || false,
        };
      })
      .filter(post => !blockedIds.includes(post.channel.id))
      .filter(post => !(hideNsfw && post.nsfw));

    return { posts, nextPage: lastVisible, total: 0 };
  } catch (error) {
    console.error("Ошибка загрузки постов:", error);
    return { posts: [], nextPage: null, total: 0 };
  }
};

export const usePosts = (tab: "subscriptions" | "recommendations") => {
  return useInfiniteQuery({
    queryKey: ["posts", tab, localStorage.getItem('hideNsfw')],
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, tab }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: null,
    staleTime: 0,
    refetchOnMount: true,
  });
};