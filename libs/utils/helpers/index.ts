type LiteralObject = Record<string, any>;

require('dotenv').config();

export function returnPaging(
  data: LiteralObject[],
  totalItems: number,
  params: LiteralObject,
  metadata = {},
  dataExtra?: LiteralObject[],
) {
  const totalPages = Math.ceil(totalItems / params.pageSize);
  return {
    paging: true,
    hasMore: params.pageIndex < totalPages,
    pageIndex: params.pageIndex,
    totalPages,
    totalItems,
    data,
    dataExtra,
    ...metadata,
  };
}

export function returnLoadMore(
  data: LiteralObject[],
  params: LiteralObject,
  metadata = {},
) {
  return {
    paging: true,
    hasMore: data.length === params.pageSize,
    data,
    pageSize: params.pageSize,
    ...metadata,
  };
}

export function assignLoadMore(params: LiteralObject) {
  params.pageSize = Number(params.pageSize) || 10;

  return params;
}

export function assignPaging(params: LiteralObject) {
  params.pageIndex = Number(params.pageIndex) || 1;
  params.pageSize = Number(params.pageSize) || 10;
  params.skip = (params.pageIndex - 1) * params.pageSize;

  return params;
}
