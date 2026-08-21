import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { TtsService } from './tts.service';
import { KenbyLiveDataService } from './kenby-live-data.service';
import { KenbyRagService } from './kenby-rag.service';
import { KenbyRouterService } from './kenby-router.service';
import { KenbyProactiveInsightService } from './kenby-proactive-insight.service';
import { KenbyAnalysisService } from './kenby-analysis.service';
import { KenbyErpRegistryService } from './kenby-erp-registry.service';
import { KenbyEntityResolverService } from './kenby-entity-resolver.service';
import { KenbyCapabilityResolverService } from './kenby-capability-resolver.service';
import { GroqLlmService } from './llm/groq-llm.service';
import { KenbyToolExecutorService } from './tools/kenby-tool-executor.service';
import { VectorRagService } from './rag/vector-rag.service';
import { LlmSynthesizerService } from './llm/llm-synthesizer.service';
import { KenbyDateResolverService } from './dates/kenby-date-resolver.service';
import { KenbyGroundingValidatorService } from './grounding/kenby-grounding-validator.service';
import { KenbyQueryScopeService } from './scope/kenby-query-scope.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    TtsService,
    KenbyLiveDataService,
    KenbyRagService,
    KenbyRouterService,
    KenbyProactiveInsightService,
    KenbyAnalysisService,
    KenbyErpRegistryService,
    KenbyEntityResolverService,
    KenbyCapabilityResolverService,
    GroqLlmService,
    KenbyToolExecutorService,
    VectorRagService,
    LlmSynthesizerService,
    KenbyDateResolverService,
    KenbyGroundingValidatorService,
    KenbyQueryScopeService,
  ],
  exports: [
    AiService,
    TtsService,
    KenbyLiveDataService,
    KenbyRagService,
    KenbyRouterService,
    KenbyProactiveInsightService,
    KenbyAnalysisService,
    KenbyErpRegistryService,
    KenbyEntityResolverService,
    KenbyCapabilityResolverService,
    GroqLlmService,
    KenbyToolExecutorService,
    VectorRagService,
    LlmSynthesizerService,
    KenbyDateResolverService,
    KenbyGroundingValidatorService,
    KenbyQueryScopeService,
  ],
})
export class AiModule {}
