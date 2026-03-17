import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
    FUND = 'FUND',
    CONVERT = 'CONVERT',
    TRADE = 'TRADE',
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @Column({
        type: 'enum',
        enum: TransactionType,
    })
    type: TransactionType;

    @Column({ nullable: true })
    fromCurrency: string;

    @Column({ nullable: true })
    toCurrency: string;

    @Column({ type: 'bigint' })
    amount: number;

    @Column({ type: 'decimal', precision: 20, scale: 6, nullable: true })
    rate: number;

    @Column({ default: 'SUCCESS' })
    status: string;

    @Column({ unique: true, nullable: true })
    idempotencyKey: string;

    @CreateDateColumn()
    timestamp: Date;
}
