-- 0. community_content_module enum 타입에 budget, places 값 추가
alter type public.community_content_module add value if not exists 'budget';
alter type public.community_content_module add value if not exists 'places';

-- 1. 공동 가계부 및 정산 테이블 생성
create table if not exists public.community_budgets (
  community_id uuid primary key references public.communities(id) on delete cascade,
  monthly_limit integer not null default 500000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_expenses (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  amount integer not null check (amount > 0),
  category text not null check (category in ('식비', '쇼핑', '문화', '교통', '기타')),
  paid_by_user_id uuid not null references auth.users(id) on delete restrict,
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. 맛집 저장 (플레이스 지도) 테이블 생성
create table if not exists public.community_places (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text,
  lat double precision not null,
  lng double precision not null,
  category text not null check (category in ('cafe', 'restaurant', 'bar', 'sightseeing', 'etc')),
  visited boolean not null default false,
  rating integer check (rating between 1 and 5),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. RLS 활성화
alter table public.community_budgets enable row level security;
alter table public.community_expenses enable row level security;
alter table public.community_places enable row level security;

-- 4. RLS 정책 설정
create policy "members can manage community budgets"
on public.community_budgets for all
to authenticated
using (public.is_community_member(community_id))
with check (public.is_community_member(community_id));

create policy "members can manage community expenses"
on public.community_expenses for all
to authenticated
using (public.is_community_member(community_id))
with check (public.is_community_member(community_id));

create policy "members can manage community places"
on public.community_places for all
to authenticated
using (public.is_community_member(community_id))
with check (public.is_community_member(community_id));

-- 5. updated_at 트리거 설정
drop trigger if exists community_budgets_set_updated_at on public.community_budgets;
create trigger community_budgets_set_updated_at
before update on public.community_budgets
for each row execute function public.set_updated_at();

drop trigger if exists community_expenses_set_updated_at on public.community_expenses;
create trigger community_expenses_set_updated_at
before update on public.community_expenses
for each row execute function public.set_updated_at();

drop trigger if exists community_places_set_updated_at on public.community_places;
create trigger community_places_set_updated_at
before update on public.community_places
for each row execute function public.set_updated_at();
