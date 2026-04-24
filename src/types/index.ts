export interface Channel {
  id: string;
  name: string;
  avatar: string;
}

export interface MediaItem {
  type: "image" | "video";
  url: string;
  thumbnail?: string;
}

export interface Post {
  id: string;
  channel: Channel;
  text: string;
  publishedAt: string;
  media?: MediaItem[];
  likes: string[];
  commentsCount: number;   // <-- было comments: any[]
  shares: number;
  authorPhotoURL?: string;
  pinned?: boolean;
}

export interface PostsResponse {
  posts: Post[];
  nextPage?: any;
  total: number;
}