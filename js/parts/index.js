/* Список частей. file — файл с текстом части (пока его нет, часть видна как «в работе»).
   requires — замок от прошлых выборов: функция от профиля игрока (P.done, P.carry). */
(function(){
const SN=window.SN=window.SN||{};
SN.VERSION="0.1.0";
SN.PARTS=[
  {id:"p0",n:0,title:"Похороны",sub:"Нью-Йорк, 1970 · развилка с Саем",file:"js/parts/p0_pohorony.js"},
  {id:"p1",n:1,title:"Шестнадцать",sub:"пролог · гл. 2.26",href:"prolog/"},
  {id:"p2",n:2,title:"Тот год",sub:"с Курамой",requires:P=>!!P.done.p1},
  {id:"p3",n:3,title:"Лондон",requires:P=>!!P.done.p2},
  {id:"p4",n:4,title:"Сделка",requires:P=>!!P.done.p3},
  {id:"p5",n:5,title:"Половинками ножниц",sub:"Париж",requires:P=>!!P.done.p4},
  {id:"p6",n:6,title:"Бог",sub:"Нью-Йорк",requires:P=>!!P.done.p5},
  {id:"p7",n:7,title:"Зимняя ночь",sub:"финал · 2.29",note:"выйдет после конца фика",requires:P=>!!P.done.p6},
  {id:"p8",n:8,title:"Жизнь",sub:"эпилог · 1989",note:"выйдет после конца фика",requires:P=>!!P.done.p7}
];
/* витрина эффектов: не часть сюжета, в меню отдельной кнопкой */
SN.PARTS.push({id:"demo",n:-1,title:"Витрина эффектов",file:"js/parts/demo.js",hidden:true});
})();
