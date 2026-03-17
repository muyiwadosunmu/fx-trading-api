import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('wallets')
@Unique(['user', 'currency']) // A user can only have one wallet per currency
export class Wallet {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @Column()
    currency: string;

    @Column({ type: 'bigint', default: 0 })
    balance: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
