import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "libs/modules/prisma/prisma.service";
import { CreateTopicDto } from "../dto/topics/create-topic.dto";
import { UpdateTopicDto } from "../dto/topics/update-topic.dto";

@Injectable()
export class NewsTopicService {
  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async create(createTopicDto: CreateTopicDto) {
    return this.prismaService.newsTopic.create({
      data: createTopicDto,
    });
  }

  async getAll() {
    return this.prismaService.newsTopic.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        _count: {
          select: { articles: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async getOne(id: number) {
    const topic = await this.prismaService.newsTopic.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with ID ${id} not found`);
    }

    return topic;
  }

  async update(id: number, updateTopicDto: UpdateTopicDto) {
    const existing = await this.getOne(id);

    return this.prismaService.newsTopic.update({
      where: { id },
      data: updateTopicDto,
    });
  }

  async deleteTopic(id: number) {
    await this.getOne(id);

    return this.prismaService.newsTopic.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      }
    });
  }
}
