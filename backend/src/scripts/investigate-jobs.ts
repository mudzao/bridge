import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigateJobs() {
  console.log('🔍 Investigating jobs for admin@acme-corp.com...\n');

  try {
    // First, find the user and tenant
    const user = await prisma.user.findUnique({
      where: { email: 'admin@acme-corp.com' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ User admin@acme-corp.com not found');
      return;
    }

    console.log('👤 User found:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Tenant: ${user.tenant.name} (${user.tenant.slug})`);
    console.log(`   Tenant ID: ${user.tenantId}\n`);

    // Get all jobs for this tenant
    const allJobs = await prisma.job.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        jobType: true,
        status: true,
        createdAt: true,
        entities: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📊 Total jobs found: ${allJobs.length}\n`);

    if (allJobs.length === 0) {
      console.log('No jobs found for this tenant.');
      return;
    }

    // Group by status
    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    allJobs.forEach((job) => {
      // Count by status
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
      
      // Count by type
      typeCounts[job.jobType] = (typeCounts[job.jobType] || 0) + 1;
    });

    console.log('📈 Jobs by Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n📋 Jobs by Type:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n📝 Recent Jobs (last 10):');
    allJobs.slice(0, 10).forEach((job, index) => {
      const date = new Date(job.createdAt).toLocaleDateString();
      console.log(`   ${index + 1}. ${job.jobType} - ${job.status} - ${date} - [${job.entities.join(', ')}]`);
    });

    console.log('\n🔍 What the /jobs/stats endpoint would count:');
    const queued = statusCounts['QUEUED'] || 0;
    const running = statusCounts['RUNNING'] || 0;
    const completed = statusCounts['COMPLETED'] || 0;
    const failed = statusCounts['FAILED'] || 0;
    const extracting = statusCounts['EXTRACTING'] || 0;
    const dataReady = statusCounts['DATA_READY'] || 0;
    const loading = statusCounts['LOADING'] || 0;

    console.log(`   QUEUED: ${queued}`);
    console.log(`   RUNNING: ${running}`);
    console.log(`   COMPLETED: ${completed}`);
    console.log(`   FAILED: ${failed}`);
    console.log(`   Current endpoint total: ${queued + running + completed + failed}`);
    console.log(`   Missing from count: EXTRACTING (${extracting}), DATA_READY (${dataReady}), LOADING (${loading})`);
    console.log(`   Actual total should be: ${allJobs.length}`);

  } catch (error) {
    console.error('❌ Error investigating jobs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation
investigateJobs()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 