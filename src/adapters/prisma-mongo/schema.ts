export interface TrafficUtmModel {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

export interface TrafficSessionModel {
  id: string;
  sessionId: string;
  visitorId?: string | null;
  userId?: string | null;
  site: string;
  environment: string;
  consentMode: string;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt?: Date | null;
  durationMs: number;
  pageCount: number;
  entryPath: string;
  entryTitle?: string | null;
  exitPath?: string | null;
  exitTitle?: string | null;
  referrer?: string | null;
  referrerHost?: string | null;
  referrerType?: string | null;
  utm?: TrafficUtmModel | null;
  userAgent?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  os?: string | null;
  deviceType?: string | null;
  screenW?: number | null;
  screenH?: number | null;
  viewportW?: number | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrafficPageviewModel {
  id: string;
  sessionId: string;
  sequence: number;
  path: string;
  title?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  durationMs: number;
  visibleMs: number;
  maxScrollPct: number;
  isExit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrafficEventModel {
  id: string;
  sessionId: string;
  name: string;
  path?: string | null;
  props?: Record<string, unknown> | null;
  ts: Date;
  createdAt: Date;
}

export const prismaMongoSchema = `
model TrafficSession {
  id             String      @id @default(auto()) @map("_id") @db.ObjectId
  sessionId      String      @unique
  visitorId      String?
  userId         String?
  site           String
  environment    String      @default("production")
  consentMode    String      @default("anonymous")
  startedAt      DateTime
  lastSeenAt     DateTime
  endedAt        DateTime?
  durationMs     Int         @default(0)
  pageCount      Int         @default(0)
  entryPath      String
  entryTitle     String?
  exitPath       String?
  exitTitle      String?
  referrer       String?
  referrerHost   String?
  referrerType   String?     @default("direct")
  utm            TrafficUtm?
  userAgent      String?
  browser        String?
  browserVersion String?
  os             String?
  deviceType     String?     @default("desktop")
  screenW        Int?
  screenH        Int?
  viewportW      Int?
  country        String?
  region         String?
  city           String?
  latitude       Float?
  longitude      Float?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@index([site, startedAt])
  @@index([site, lastSeenAt])
  @@index([site, visitorId])
  @@index([site, userId])
  @@map("traffic_sessions")
}

type TrafficUtm {
  source   String?
  medium   String?
  campaign String?
  term     String?
  content  String?
}

model TrafficPageview {
  id           String    @id @default(auto()) @map("_id") @db.ObjectId
  sessionId    String
  sequence     Int
  path         String
  title        String?
  startedAt    DateTime
  endedAt      DateTime?
  durationMs   Int       @default(0)
  visibleMs    Int       @default(0)
  maxScrollPct Int       @default(0)
  isExit       Boolean   @default(false)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([sessionId, sequence])
  @@index([sessionId])
  @@index([path])
  @@index([startedAt])
  @@map("traffic_pageviews")
}

model TrafficEvent {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionId String
  name      String
  path      String?
  props     Json?
  ts        DateTime
  createdAt DateTime @default(now())

  @@index([sessionId])
  @@index([name])
  @@index([ts])
  @@map("traffic_events")
}
`.trim();
