import { Types } from 'mongoose';
import { Media, IMedia } from '../models/Media.ts';
import { MemoryStatus } from '../constants/index.ts';

export class MediaRepository {
  async create(data: Partial<IMedia>): Promise<IMedia> {
    return Media.create(data);
  }

  async findById(id: string | Types.ObjectId): Promise<IMedia | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Media.findById(id).populate('uploadedBy', 'displayName email avatar');
  }

  async findByMemory(memoryId: string | Types.ObjectId): Promise<IMedia[]> {
    if (!Types.ObjectId.isValid(memoryId)) return [];
    return Media.find({
      memoryId: new Types.ObjectId(memoryId),
      status: MemoryStatus.ACTIVE,
    })
      .sort({ createdAt: 1 })
      .populate('uploadedBy', 'displayName email avatar')
      .lean();
  }

  async findByChecksum(familyId: string | Types.ObjectId, sha256Checksum: string): Promise<IMedia | null> {
    return Media.findOne({
      familyId: new Types.ObjectId(familyId),
      sha256Checksum,
      status: MemoryStatus.ACTIVE,
    });
  }

  async findDuplicateInMemory(
    familyId: string | Types.ObjectId,
    memoryId: string | Types.ObjectId,
    sha256Checksum: string
  ): Promise<IMedia | null> {
    return Media.findOne({
      familyId: new Types.ObjectId(familyId),
      memoryId: new Types.ObjectId(memoryId),
      sha256Checksum,
      status: MemoryStatus.ACTIVE,
    });
  }

  async update(id: string | Types.ObjectId, data: Partial<IMedia>): Promise<IMedia | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Media.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async delete(id: string | Types.ObjectId): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await Media.findByIdAndDelete(id);
    return !!res;
  }

  async archive(id: string | Types.ObjectId): Promise<IMedia | null> {
    return this.update(id, { status: MemoryStatus.ARCHIVED });
  }

  async countByFamily(familyId: string | Types.ObjectId): Promise<number> {
    return Media.countDocuments({
      familyId: new Types.ObjectId(familyId),
      status: MemoryStatus.ACTIVE,
    });
  }
}

export const mediaRepository = new MediaRepository();
