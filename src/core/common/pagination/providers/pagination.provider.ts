import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import {
    FindOptionsOrder,
    FindOptionsWhere,
    ObjectLiteral,
    Repository,
} from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { Paginated } from '../interfaces/paginated.interfaces';

@Injectable()
export class PaginationProvider {

    constructor(@Inject(REQUEST) private readonly request: Request) { }

    public async paginateQuery<T extends ObjectLiteral>(
        paginationQuery: PaginationQueryDto,
        repository: Repository<T>,
        filters?: FindOptionsWhere<T>,
        order?: FindOptionsOrder<T>,
    ): Promise<Paginated<T>> {
        // Apply pagination with optional filters
        const results = await repository.find({
            where: filters, // Apply filters here in the "where" clause
            skip: (paginationQuery.page - 1) * paginationQuery.limit,
            take: paginationQuery.limit,
            order: order,
        });

        // Calculate total items with filters applied
        const totalItems = await repository.count({ where: filters }); // Correct use of filters in count()

        const totalPages = Math.ceil(totalItems / paginationQuery.limit);

        const baseURL =
            this.request.protocol + '://' + this.request.headers.host + '/';
        const newUrl = new URL(this.request.url, baseURL);

        const nextPage =
            paginationQuery.page === totalPages
                ? paginationQuery.page
                : paginationQuery.page + 1;
        const previousPage =
            paginationQuery.page === 1
                ? paginationQuery.page
                : paginationQuery.page - 1;

        const finalResponse = {
            data: results,
            meta: {
                itemsPerPage: paginationQuery.limit,
                totalItems: totalItems,
                currentPage: paginationQuery.page,
                totalPages: totalPages,
            },
            links: {
                first: `${newUrl.origin}${newUrl.pathname}?limit=${paginationQuery.limit}&page=1`,
                last: `${newUrl.origin}${newUrl.pathname}?limit=${paginationQuery.limit}&page=${totalPages}`,
                current: `${newUrl.origin}${newUrl.pathname}?limit=${paginationQuery.limit}&page=${paginationQuery.page}`,
                next: `${newUrl.origin}${newUrl.pathname}?limit=${paginationQuery.limit}&page=${nextPage}`,
                previous: `${newUrl.origin}${newUrl.pathname}?limit=${paginationQuery.limit}&page=${previousPage}`,
            },
        };

        return finalResponse;
    }
}