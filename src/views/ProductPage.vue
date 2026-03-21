<template>
  <main class="page" v-if="product">
    <section class="product-box">
      <!-- 브랜드 -->
      <p class="brand">고마마</p>

      <!-- 상품명 -->
      <h1 class="title">{{ product.name }}</h1>

      <!-- 설명 -->
      <p class="desc">{{ product.description }}</p>

      <!-- 옵션 -->
      <div class="section">
        <p class="label">옵션 선택</p>
        <div class="option-list">
          <button
            v-for="option in options"
            :key="option.id"
            :class="['option-button', { active: selectedOption?.id === option.id }]"
            @click="selectOption(option)"
          >
            {{ option.name }}
          </button>
        </div>
      </div>

      <!-- 수량 -->
      <div class="section">
        <p class="label">수량</p>
        <div class="qty-box">
          <button @click="decreaseQty">-</button>
          <span>{{ quantity }}</span>
          <button @click="increaseQty">+</button>
        </div>
      </div>

      <!-- 가격 -->
      <div class="price-box">
        <span>총 금액</span>
        <strong>{{ totalPrice.toLocaleString() }}원</strong>
      </div>

      <!-- 구매 버튼 -->
      <button class="buy-button" @click="handleBuy">구매하기</button>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import api from '@/lib/axios'

const product = ref(null)
const options = ref([])
const selectedOption = ref(null)
const quantity = ref(1)

onMounted(async () => {
  const { data: productData } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single()

  product.value = productData

  const { data: optionData } = await supabase
    .from('product_options')
    .select('*')
    .eq('product_id', productData.id)

  options.value = optionData
  selectedOption.value = optionData[0]

  try {
    const res = await api.get('https://jsonplaceholder.typicode.com/posts/1')
    console.log('외부 API 데이터', res.data)
  } catch (error) {
    console.error('외부 API 에러', error)
  }
})

function selectOption(option) {
  selectedOption.value = option
}

function increaseQty() {
  quantity.value++
}

function decreaseQty() {
  if (quantity.value > 1) quantity.value--
}

const totalPrice = computed(() => {
  if (!selectedOption.value) return 0
  return selectedOption.value.price * quantity.value
})

// 구매 버튼
async function handleBuy() {
  console.log('product:', product.value)
  console.log('selectedOption:', selectedOption.value)
  // 선택된 상품이 없으면 중단
  if (!product.value || !selectedOption.value) return

  // 주문 데이터
  const orderPayload = {
    product_id: product.value.id,
    product_name: product.value.name,
    option_id: selectedOption.value.id,
    option_name: selectedOption.value.name,
    quantity: quantity.value,
    total_amount: totalPrice.value,
  }
  console.log('주문 payload', orderPayload)
  try {
    const res = await api.post('https://jsonplaceholder.typicode.com/posts', orderPayload)
    console.log('주문 성공', res.data)
  } catch (error) {
    console.error('주문 전송 에러', error)
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: var(--space-lg) var(--space-md);
  background: var(--color-bg);
}

.product-box {
  max-width: 520px;
  margin: 0 auto;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.brand {
  font-size: var(--font-sm);
  color: var(--color-brand);
  font-weight: 700;
}

.title {
  font-size: var(--font-xl);
  margin: var(--space-xs) 0;
}

.desc {
  color: var(--color-muted);
  margin-bottom: var(--space-lg);
}

.section {
  margin-bottom: 20px;
}

.label {
  font-size: var(--font-sm);
  font-weight: 700;
  margin-bottom: 10px;
}

.option-list {
  display: flex;
  gap: var(--space-sm);
}

.option-button {
  flex: 1;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.option-button.active {
  border-color: var(--color-text);
  font-weight: 700;
}

.qty-box {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.qty-box button {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.price-box {
  display: flex;
  justify-content: space-between;
  margin: 20px 0;
}

.price-box strong {
  font-size: var(--font-lg);
}

.buy-button {
  width: 100%;
  padding: var(--space-md);
  background: var(--color-text);
  color: var(--color-surface);
  border-radius: var(--radius-md);
}
</style>