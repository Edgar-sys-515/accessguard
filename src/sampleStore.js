'use strict';
/*
 * Loja de exemplo — imita os dados que a API da Shopify devolveria.
 * Serve para testar o motor sem precisar de uma loja de verdade conectada.
 * (Espelha a loja-teste "accessguard-dev" com produtos e problemas propositais.)
 */
module.exports = {
  shop: 'accessguard-dev.myshopify.com',
  theme: { lang: null }, // problema: sem idioma declarado
  products: [
    { title: 'The Collection Snowboard: Liquid', images: [
      { src: 'liquid-1.jpg', alt: '' },        // problema: sem alt
      { src: 'liquid-2.jpg', alt: 'Prancha azul' },
    ]},
    { title: 'The Collection Snowboard: Hydrogen', images: [
      { src: 'hydrogen-1.jpg', alt: '' },       // problema
    ]},
    { title: 'The 3p Fulfilled Snowboard', images: [
      { src: '3p-1.jpg', alt: '' },             // problema
      { src: '3p-2.jpg', alt: '' },             // problema
    ]},
    { title: 'Gift Card', images: [
      { src: 'gift.jpg', alt: 'Cartão-presente da loja' }, // ok
    ]},
  ],
  textElements: [
    { where: 'Botão "Comprar agora"', color: '#9BE7D8', background: '#FFFFFF', large: false }, // contraste baixo
    { where: 'Legenda do preço', color: '#B0B0B0', background: '#FFFFFF', large: false },       // contraste baixo
    { where: 'Título do produto', color: '#1A1A1A', background: '#FFFFFF', large: true },        // ok
  ],
  links: [
    { text: 'Clique aqui', href: '/collections/all' },   // problema
    { text: 'Saiba mais', href: '/pages/about' },        // problema
    { text: 'Ver todos os snowboards', href: '/collections/snowboards' }, // ok
  ],
  formFields: [
    { name: 'contact-email', label: '' },  // problema: sem rótulo
    { name: 'contact-name', label: 'Nome' }, // ok
  ],
};
