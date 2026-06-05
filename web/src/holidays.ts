export interface HolidayInfo {
  name: string;
  shortName: string;
  kind: "public" | "substitute" | "election";
}

const fixedKoreanHolidays: Record<string, HolidayInfo> = {
  "01-01": { name: "신정", shortName: "신정", kind: "public" },
  "03-01": { name: "삼일절", shortName: "삼일절", kind: "public" },
  "05-05": { name: "어린이날", shortName: "어린이날", kind: "public" },
  "06-06": { name: "현충일", shortName: "현충일", kind: "public" },
  "08-15": { name: "광복절", shortName: "광복절", kind: "public" },
  "10-03": { name: "개천절", shortName: "개천절", kind: "public" },
  "10-09": { name: "한글날", shortName: "한글날", kind: "public" },
  "12-25": { name: "성탄절", shortName: "성탄절", kind: "public" }
};

const datedKoreanHolidays: Record<string, HolidayInfo> = {
  "2026-02-16": { name: "설날 연휴", shortName: "설연휴", kind: "public" },
  "2026-02-17": { name: "설날", shortName: "설날", kind: "public" },
  "2026-02-18": { name: "설날 연휴", shortName: "설연휴", kind: "public" },
  "2026-03-02": { name: "삼일절 대체공휴일", shortName: "대체", kind: "substitute" },
  "2026-05-24": { name: "부처님오신날", shortName: "부처님", kind: "public" },
  "2026-05-25": { name: "부처님오신날 대체공휴일", shortName: "대체", kind: "substitute" },
  "2026-06-03": { name: "전국동시지방선거", shortName: "선거일", kind: "election" },
  "2026-08-17": { name: "광복절 대체공휴일", shortName: "대체", kind: "substitute" },
  "2026-09-24": { name: "추석 연휴", shortName: "추석", kind: "public" },
  "2026-09-25": { name: "추석", shortName: "추석", kind: "public" },
  "2026-09-26": { name: "추석 연휴", shortName: "추석", kind: "public" },
  "2026-10-05": { name: "개천절 대체공휴일", shortName: "대체", kind: "substitute" }
};

export function getKoreanHoliday(dateKey: string): HolidayInfo | null {
  return datedKoreanHolidays[dateKey] ?? fixedKoreanHolidays[dateKey.slice(5)] ?? null;
}
