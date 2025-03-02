export interface PaginatedData<T> {
  data: T[],
  lastPage: number,
  page: number;
  total: number;
}
