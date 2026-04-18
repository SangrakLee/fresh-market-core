<script setup>
const companyInfo = {
  name: '큰그림',
  owner: '이상락',
  businessNumber: '219-06-67795',
  mailOrderNumber: '2021-경북성주-111',
  address: '경상북도 성주군 선남면 유서리1길 48',
  contact: '010-6722-8312',
  email: 'support@gomama.co.kr',
}
</script>

<template>
  <footer class="mx-auto mt-8 w-full max-w-[430px] px-6 pb-24 text-xs leading-5 text-black/55">
    <div class="border-t border-black/10 pt-4">
      <p class="font-semibold text-black/70">{{ companyInfo.name }}</p>
      <p>대표자: {{ companyInfo.owner }}</p>
      <p>사업자등록번호: {{ companyInfo.businessNumber }}</p>
      <p>통신판매업신고: {{ companyInfo.mailOrderNumber }}</p>
      <p>주소: {{ companyInfo.address }}</p>
      <p>고객센터: {{ companyInfo.contact }}</p>
      <p>이메일: {{ companyInfo.email }}</p>
    </div>
  </footer>
</template>
