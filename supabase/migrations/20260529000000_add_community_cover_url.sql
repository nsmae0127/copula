-- communities 테이블에 배경 이미지 URL을 저장할 cover_url 컬럼 추가
alter table public.communities add column if not exists cover_url text;
