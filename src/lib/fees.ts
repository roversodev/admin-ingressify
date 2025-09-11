// Configuração centralizada de taxas da plataforma
export const PLATFORM_FEES = {
  // Taxas por método de pagamento (em decimal)
  PIX: 0.10,        // 10%
  CARD: 0.10,       // 10%
  
  // Taxas em porcentagem (para exibição)
  PIX_PERCENT: 10,
  CARD_PERCENT: 10,
  
  // Taxa padrão para cálculos legados
  DEFAULT: 0.10,
  DEFAULT_PERCENT: 10
} as const;

// Tipos para garantir type safety
export type PaymentMethod = 'PIX' | 'CARD';

// Funções utilitárias para cálculos de taxa
// Adicionar interface para configurações customizadas
export interface CustomFeeSettings {
  pixFeePercentage?: number;
  cardFeePercentage?: number;
  useCustomFees: boolean;
}

// Atualizar as funções de cálculo para aceitar configurações customizadas
export const feeCalculations = {
  /**
   * Calcula a taxa baseada no método de pagamento e configurações customizadas
   */
  calculateFee(
    subtotal: number, 
    paymentMethod: PaymentMethod, 
    customSettings?: CustomFeeSettings
  ): number {
    let rate: number;
    
    if (customSettings?.useCustomFees) {
      // Usar taxas customizadas se disponíveis
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        rate = customSettings.pixFeePercentage;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        rate = customSettings.cardFeePercentage;
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
    customSettings?: CustomFeeSettings
  ): number {
    const fee = this.calculateFee(subtotal, paymentMethod, customSettings);
    return subtotal + fee - discountAmount;
  },

  /**
   * Calcula o valor do produtor com taxas customizadas
   */
  calculateProducerAmount(
    totalAmount: number, 
    discountAmount: number, 
    paymentMethod: PaymentMethod,
    customSettings?: CustomFeeSettings
  ): number {
    let rate: number;
    
    if (customSettings?.useCustomFees) {
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        rate = customSettings.pixFeePercentage;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        rate = customSettings.cardFeePercentage;
      } else {
        rate = PLATFORM_FEES[paymentMethod];
      }
    } else {
      rate = PLATFORM_FEES[paymentMethod];
    }
    
    return ((totalAmount + discountAmount) / (1 + rate)) - discountAmount;
  },

  /**
   * Obtém a taxa em porcentagem para exibição
   */
  getFeePercentage(
    paymentMethod: PaymentMethod, 
    customSettings?: CustomFeeSettings
  ): number {
    if (customSettings?.useCustomFees) {
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        return customSettings.pixFeePercentage * 100;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        return customSettings.cardFeePercentage * 100;
      }
    }
    
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
    customSettings?: CustomFeeSettings
  ): number {
    const producerAmount = this.calculateProducerAmount(totalAmount, discountAmount, paymentMethod, customSettings);
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
    customSettings?: CustomFeeSettings
  ): number {
    let rate: number;
    
    if (customSettings?.useCustomFees) {
      if (paymentMethod === 'PIX' && customSettings.pixFeePercentage !== undefined) {
        rate = customSettings.pixFeePercentage;
      } else if (paymentMethod === 'CARD' && customSettings.cardFeePercentage !== undefined) {
        rate = customSettings.cardFeePercentage;
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
  validateCalculations(subtotal: number, paymentMethod: PaymentMethod, discountAmount: number = 0, customSettings?: CustomFeeSettings) {
    const fee = this.calculateFee(subtotal, paymentMethod, customSettings);
    const totalPaid = subtotal + fee - discountAmount; // O que o cliente realmente paga
    const producerAmount = this.calculateProducerAmount(totalPaid, discountAmount, paymentMethod, customSettings);
    const platformFee = this.calculatePlatformFee(totalPaid, discountAmount, paymentMethod, customSettings);
    const originalAmount = this.calculateOriginalAmount(totalPaid, paymentMethod, discountAmount, customSettings);
    
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