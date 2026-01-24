// Configuração centralizada de taxas da plataforma
export const PLATFORM_FEES = {
  // Taxas por método de pagamento (em decimal)
  PIX: 0.10,        // 10%
  CARD: 0.10,       // 10%
  OFFLINE: 0.05,    // 10%
  
  // Taxas em porcentagem (para exibição)
  PIX_PERCENT: 10,
  CARD_PERCENT: 10,
  OFFLINE_PERCENT: 5,
  
  // Taxa padrão para cálculos legados
  DEFAULT: 0.10,
  DEFAULT_PERCENT: 10
} as const;

// Tipos para garantir type safety
export type PaymentMethod = 'PIX' | 'CARD' | 'OFFLINE';

// Funções utilitárias para cálculos de taxa
// Adicionar interface para configurações customizadas
export interface CustomFeeSettings {
  pixFeePercentage?: number;
  cardFeePercentage?: number;
  offlineFee?: number;
  useCustomFees: boolean;
  absorbFees?: boolean;
}

// Atualizar as funções de cálculo para aceitar configurações customizadas
export const feeCalculations = {
  /**
   * Calcula a taxa baseada no método de pagamento e configurações customizadas
   */
  calculateFee(
    subtotal: number, 
    paymentMethod: PaymentMethod, 
    customSettings?: CustomFeeSettings,
    transactionMetadata?: any
  ): number {
    // Se o produtor absorve a taxa, a taxa para o comprador é 0
    // Verificar absorbFees no metadata também
    const shouldAbsorbFees = 
      transactionMetadata?.feeSnapshot?.absorbFees ?? 
      transactionMetadata?.absorbFees ?? 
      customSettings?.absorbFees;

    if (shouldAbsorbFees) {
      return 0;
    }

    let rate: number;
    
    // Verificar taxa no metadata (prioridade alta)
    const metadataFee = transactionMetadata?.offlineFee ?? transactionMetadata?.feeRate;

    if (paymentMethod === 'OFFLINE' && metadataFee !== undefined) {
      rate = Number(metadataFee);
    } else if (customSettings?.useCustomFees) {
      // Usar taxas customizadas se disponíveis
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        rate = customSettings.pixFeePercentage;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        rate = customSettings.cardFeePercentage;
      } else if (paymentMethod === 'OFFLINE' && customSettings.offlineFee !== undefined) {
        rate = customSettings.offlineFee;
      } else {
        // Fallback para taxa padrão se customizada não estiver definida
        rate = PLATFORM_FEES[paymentMethod];
      }
    } else {
      // Usar taxas padrão
      rate = PLATFORM_FEES[paymentMethod];
    }
    
    return subtotal * rate;
  },

  /**
   * Calcula o total com taxa customizada
   */
  calculateTotal(
    subtotal: number, 
    paymentMethod: PaymentMethod, 
    discountAmount: number = 0,
    customSettings?: CustomFeeSettings,
    transactionMetadata?: any
  ): number {
    const fee = this.calculateFee(subtotal, paymentMethod, customSettings, transactionMetadata);
    return subtotal + fee - discountAmount;
  },

  /**
   * Calcula o valor do produtor com taxas customizadas
   */
  calculateProducerAmount(
    totalAmount: number, 
    discountAmount: number, 
    paymentMethod: PaymentMethod,
    customSettings?: CustomFeeSettings,
    transactionMetadata?: any
  ): number {
    let rate: number;
    
    // Priorizar absorbFees do metadata da transação (snapshot ou direto)
    const shouldAbsorbFees = 
      transactionMetadata?.feeSnapshot?.absorbFees ?? 
      transactionMetadata?.absorbFees ?? 
      customSettings?.absorbFees;

    // Verificar taxa no metadata (prioridade alta)
    const metadataFee = transactionMetadata?.offlineFee ?? transactionMetadata?.feeRate;

    if (paymentMethod === 'OFFLINE' && metadataFee !== undefined) {
      rate = Number(metadataFee);
    } else if (customSettings?.useCustomFees) {
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        rate = customSettings.pixFeePercentage;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        rate = customSettings.cardFeePercentage;
      } else if (paymentMethod === 'OFFLINE' && customSettings.offlineFee !== undefined) {
        rate = customSettings.offlineFee;
      } else {
        rate = PLATFORM_FEES[paymentMethod];
      }
    } else {
      rate = PLATFORM_FEES[paymentMethod];
    }
    
    if (shouldAbsorbFees) {
      // Se a taxa é absorvida, o totalAmount é o valor do ingresso (sem taxa adicional).
      // O produtor recebe: ValorIngresso - (ValorIngresso * Taxa)
      // totalAmount já é o ValorIngresso (pois fee é 0 para o comprador).
      // Mas precisamos considerar que o totalAmount inclui o desconto que foi subtraído para o comprador.
      // ValorOriginal = totalAmount + discountAmount
      // Fee = ValorOriginal * rate
      // ProducerAmount = TotalAmount - Fee
      
      const originalAmount = totalAmount + discountAmount;
      const fee = originalAmount * rate;
      return totalAmount - fee;
    }

    return ((totalAmount + discountAmount) / (1 + rate)) - discountAmount;
  },

  /**
   * Obtém a taxa em porcentagem para exibição
   */
  getFeePercentage(
    paymentMethod: PaymentMethod, 
    customSettings?: CustomFeeSettings,
    transactionMetadata?: any
  ): number {
    // Verificar metadata
    const metadataFee = transactionMetadata?.offlineFee ?? transactionMetadata?.feeRate;
    if (paymentMethod === 'OFFLINE' && metadataFee !== undefined) {
      return Number(metadataFee) * 100;
    }

    if (customSettings?.useCustomFees) {
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        return customSettings.pixFeePercentage * 100;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        return customSettings.cardFeePercentage * 100;
      } else if (paymentMethod === 'OFFLINE' && customSettings.offlineFee !== undefined) {
        return customSettings.offlineFee * 100;
      }
    }
    
    if (paymentMethod === 'OFFLINE') return PLATFORM_FEES.OFFLINE_PERCENT;
    return paymentMethod === 'PIX' ? PLATFORM_FEES.PIX_PERCENT : PLATFORM_FEES.CARD_PERCENT;
  },
  
  /**
   * Calcula a taxa da plataforma
   * A plataforma sempre recebe: totalAmount - producerAmount
   */
  calculatePlatformFee(
    totalAmount: number, 
    discountAmount: number, 
    paymentMethod: PaymentMethod,
    customSettings?: CustomFeeSettings,
    transactionMetadata?: any
  ): number {
    const producerAmount = this.calculateProducerAmount(totalAmount, discountAmount, paymentMethod, customSettings, transactionMetadata);
    return totalAmount - producerAmount;
  },
  
  /**
   * Calcula o valor original antes da taxa (para relatórios financeiros)
   * Usado quando temos o valor final e precisamos do valor base
   */
  calculateOriginalAmount(
    totalWithFee: number, 
    paymentMethod: PaymentMethod, 
    discountAmount: number = 0,
    customSettings?: CustomFeeSettings,
    transactionMetadata?: any
  ): number {
    let rate: number;

    // Verificar taxa no metadata (prioridade alta)
    const metadataFee = transactionMetadata?.offlineFee ?? transactionMetadata?.feeRate;

    if (paymentMethod === 'OFFLINE' && metadataFee !== undefined) {
      rate = Number(metadataFee);
    } else if (customSettings?.useCustomFees) {
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        rate = customSettings.pixFeePercentage;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        rate = customSettings.cardFeePercentage;
      } else if (paymentMethod === 'OFFLINE' && customSettings.offlineFee !== undefined) {
        rate = customSettings.offlineFee;
      } else {
        rate = PLATFORM_FEES[paymentMethod];
      }
    } else {
      rate = PLATFORM_FEES[paymentMethod];
    }
    
    return (totalWithFee + discountAmount) / (1 + rate);
  },
  
  /**
   * Função para validar os cálculos com exemplo real
   */
  validateCalculations(subtotal: number, paymentMethod: PaymentMethod, discountAmount: number = 0, customSettings?: CustomFeeSettings, transactionMetadata?: any) {
    const fee = this.calculateFee(subtotal, paymentMethod, customSettings, transactionMetadata);
    const totalPaid = subtotal + fee - discountAmount; // O que o cliente realmente paga
    const producerAmount = this.calculateProducerAmount(totalPaid, discountAmount, paymentMethod, customSettings, transactionMetadata);
    const platformFee = this.calculatePlatformFee(totalPaid, discountAmount, paymentMethod, customSettings, transactionMetadata);
    const originalAmount = this.calculateOriginalAmount(totalPaid, paymentMethod, discountAmount, customSettings, transactionMetadata);
    
    return {
      // Valores de entrada
      subtotal,
      discountAmount,
      paymentMethod,
      
      // Valores calculados
      fee, // Taxa calculada sobre o subtotal
      totalPaid, // O que o cliente efetivamente paga
      producerAmount, // O que o produtor recebe
      platformFee, // O que a plataforma recebe
      originalAmount, // Valor original (deve ser igual ao subtotal)
      
      // Validações
      validations: {
        totalPaidEqualsSubtotalPlusFeeMinusDiscount: Math.abs(totalPaid - (subtotal + fee - discountAmount)) < 0.01,
        totalPaidEqualsProducerPlusPlatformFee: Math.abs(totalPaid - (producerAmount + platformFee)) < 0.01,
        originalAmountEqualsSubtotal: Math.abs(originalAmount - subtotal) < 0.01,
        platformFeeEqualsExpectedFee: Math.abs(platformFee - fee) < 0.01 // A plataforma deve receber a taxa completa
      }
    };
  }
};