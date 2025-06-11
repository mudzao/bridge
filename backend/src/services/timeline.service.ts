import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TimelineEventData {
  jobId: string;
  tenantId: string;
  eventType: 'status_change' | 'progress_update' | 'discovery' | 'pause' | 'resume' | 'error' | 'completion';
  message: string;
  metadata?: {
    recordsProcessed?: number;
    totalRecords?: number;
    percentage?: number;
    entityProgressPercentage?: number;
    currentEntity?: string;
    previousStatus?: string;
    newStatus?: string;
    error?: string;
    phase?: string;
    totalErrors?: number;
  };
}

export class TimelineService {
  /**
   * Log a timeline event
   */
  static async logEvent(data: TimelineEventData): Promise<void> {
    try {
      await prisma.jobTimelineEvent.create({
        data: {
          jobId: data.jobId,
          tenantId: data.tenantId,
          eventType: data.eventType,
          message: data.message,
          metadata: data.metadata || {},
        },
      });
      
      console.log(`Timeline event logged: ${data.message}`);
    } catch (error) {
      console.error('Failed to log timeline event:', error);
      // Don't throw - timeline logging shouldn't break job execution
    }
  }

  /**
   * Get timeline events for a job
   */
  static async getJobTimeline(jobId: string, tenantId: string) {
    return prisma.jobTimelineEvent.findMany({
      where: { jobId, tenantId },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        timestamp: true,
        eventType: true,
        message: true,
        metadata: true,
      },
    });
  }

  /**
   * Get minute-by-minute progress data
   */
  static async getMinuteProgress(jobId: string, tenantId: string) {
    const events = await prisma.jobTimelineEvent.findMany({
      where: { 
        jobId, 
        tenantId,
        eventType: 'progress_update'
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group events by minute and extract records retrieved
    const minuteData: Record<string, { recordsRetrieved: number; status: string }> = {};
    
    events.forEach(event => {
      const minute = event.timestamp.toISOString().substring(11, 16); // HH:MM
      const metadata = event.metadata as any;
      
      if (!minuteData[minute]) {
        minuteData[minute] = { recordsRetrieved: 0, status: 'normal' };
      }
      
      // Calculate records retrieved in this minute
      if (metadata?.recordsProcessed) {
        minuteData[minute].recordsRetrieved = metadata.recordsProcessed;
      }
      
      // Detect pauses/rate limits from message
      if (event.message.includes('paused') || event.message.includes('rate limit')) {
        minuteData[minute].status = 'rate_limited';
      }
    });

    return Object.entries(minuteData).map(([minute, data]) => ({
      minute,
      recordsRetrieved: data.recordsRetrieved,
      status: data.status,
    }));
  }

  /**
   * Get timeline events with filtering options
   */
  static async getFilteredTimeline(
    jobId: string, 
    tenantId: string, 
    options?: {
      eventTypes?: string[];
      limit?: number;
      offset?: number;
    }
  ) {
    const whereClause: any = { jobId, tenantId };
    
    if (options?.eventTypes && options.eventTypes.length > 0) {
      whereClause.eventType = { in: options.eventTypes };
    }

    const queryOptions: any = {
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        timestamp: true,
        eventType: true,
        message: true,
        metadata: true,
      },
    };

    if (options?.limit !== undefined) {
      queryOptions.take = options.limit;
    }

    if (options?.offset !== undefined) {
      queryOptions.skip = options.offset;
    }

    return prisma.jobTimelineEvent.findMany(queryOptions);
  }

  /**
   * Get timeline statistics for a job
   */
  static async getTimelineStats(jobId: string, tenantId: string) {
    const stats = await prisma.jobTimelineEvent.groupBy({
      by: ['eventType'],
      where: { jobId, tenantId },
      _count: {
        eventType: true,
      },
    });

    const totalEvents = await prisma.jobTimelineEvent.count({
      where: { jobId, tenantId },
    });

    return {
      totalEvents,
      eventTypeBreakdown: stats.reduce((acc, stat) => {
        acc[stat.eventType] = stat._count.eventType;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Delete old timeline events (cleanup utility)
   */
  static async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.jobTimelineEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`Cleaned up ${result.count} old timeline events`);
    return result.count;
  }

  /**
   * Get progress velocity (records per minute over time)
   */
  static async getProgressVelocity(jobId: string, tenantId: string) {
    const progressEvents = await prisma.jobTimelineEvent.findMany({
      where: { 
        jobId, 
        tenantId,
        eventType: 'progress_update'
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        metadata: true,
      },
    });

    const velocityData = [];
    let previousRecords = 0;
    let previousTime: Date | null = null;

    for (const event of progressEvents) {
      const metadata = event.metadata as any;
      const currentRecords = metadata?.recordsProcessed || 0;
      
      if (previousTime) {
        const timeDiffMinutes = (event.timestamp.getTime() - previousTime.getTime()) / (1000 * 60);
        const recordsDiff = currentRecords - previousRecords;
        const velocity = timeDiffMinutes > 0 ? recordsDiff / timeDiffMinutes : 0;
        
        velocityData.push({
          timestamp: event.timestamp,
          recordsPerMinute: Math.round(velocity),
          totalRecords: currentRecords,
        });
      }
      
      previousRecords = currentRecords;
      previousTime = event.timestamp;
    }

    return velocityData;
  }
} 