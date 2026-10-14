/** cn-hotrank 公共类型 */

/** 单条热点 */
export interface HotItem {
  /** 排名（1 起） */
  rank: number;
  /** 标题/热词 */
  title: string;
  /** 热度值（平台无热度字段时为 null） */
  heat: number | null;
  /** 平台标签：爆/沸/新/热 等（无则 undefined） */
  tag?: string;
  /** 话题/搜索链接（无则 undefined） */
  url?: string;
}

/** 单平台抓取结果 */
export interface PlatformResult {
  platform: string;
  label: string;
  ok: boolean;
  /** true = 本次返回的是缓存旧数据（抓取失败降级） */
  stale: boolean;
  /** ISO 时间 */
  fetchedAt: string;
  items: HotItem[];
  /** 失败原因（ok=false 时） */
  error?: string;
}

/** get_hot_rank 工具返回 */
export interface HotRankResponse {
  generatedAt: string;
  results: PlatformResult[];
}

/** 平台注册表项 */
export interface SourceDef {
  platform: string;
  label: string;
  /** 抓取函数 */
  fetch: (count: number) => Promise<HotItem[]>;
  /** 缓存 TTL（毫秒） */
  ttlMs: number;
}
